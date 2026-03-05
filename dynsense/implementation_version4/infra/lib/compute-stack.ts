// Ref: ARCHITECTURE 1.md §1.2 — ComputeStack: ECS Fargate (1 task), ALB, WAF
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";

interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  appSecurityGroup: ec2.SecurityGroup;
  dbEndpoint: string;
  dbCredentials: secretsmanager.Secret;
  jwtSecret: secretsmanager.Secret;
  githubWebhookSecret: secretsmanager.Secret;
}

export class ComputeStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // --- ECS Cluster ---
    const cluster = new ecs.Cluster(this, "DynsenseCluster", {
      vpc: props.vpc,
      clusterName: "dynsense",
      containerInsights: true,
    });

    // --- Task Definition (1 vCPU, 2GB RAM) ---
    const taskDef = new ecs.FargateTaskDefinition(this, "ApiTaskDef", {
      memoryLimitMiB: 2048,
      cpu: 1024,
    });

    // Grant Bedrock access to the task role
    taskDef.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: ["*"],
    }));

    // Grant Secrets Manager read access
    props.dbCredentials.grantRead(taskDef.taskRole);
    props.jwtSecret.grantRead(taskDef.taskRole);
    props.githubWebhookSecret.grantRead(taskDef.taskRole);

    // --- Container ---
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      logGroupName: "/dynsense/api",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    taskDef.addContainer("api", {
      image: ecs.ContainerImage.fromRegistry("PLACEHOLDER:latest"), // Updated by CI/CD
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "api" }),
      portMappings: [{ containerPort: 3001, protocol: ecs.Protocol.TCP }],
      environment: {
        NODE_ENV: "production",
        API_PORT: "3001",
        API_HOST: "0.0.0.0",
        AWS_REGION: this.region,
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(props.dbCredentials, "connectionString"),
        JWT_SECRET: ecs.Secret.fromSecretsManager(props.jwtSecret),
        GITHUB_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(props.githubWebhookSecret),
      },
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // --- Fargate Service (1 task) ---
    this.service = new ecs.FargateService(this, "ApiService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      securityGroups: [props.appSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
    });

    // --- Application Load Balancer ---
    this.alb = new elbv2.ApplicationLoadBalancer(this, "DynsenseAlb", {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.appSecurityGroup,
    });

    // Allow inbound HTTPS on ALB security group
    props.appSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS from internet",
    );
    props.appSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP for redirect",
    );

    // HTTP listener — redirect to HTTPS
    this.alb.addListener("HttpListener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // HTTPS listener (certificate must be added manually or via ACM)
    const httpsListener = this.alb.addListener("HttpsListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      // Certificate ARN must be provided via context or parameter
      defaultAction: elbv2.ListenerAction.fixedResponse(503, {
        contentType: "text/plain",
        messageBody: "Service starting...",
      }),
    });

    // Target group for ECS service
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "ApiTargetGroup", {
      vpc: props.vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.service],
      healthCheck: {
        path: "/health",
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    httpsListener.addTargetGroups("ApiTarget", {
      targetGroups: [targetGroup],
    });

    // --- WAF WebACL (SOC 2: rate limiting, SQL injection, XSS protection) ---
    const waf = new wafv2.CfnWebACL(this, "DynsenseWaf", {
      defaultAction: { allow: {} },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "DynsenseWaf",
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rate limiting: 1000 requests per 5 min per IP
        {
          name: "RateLimit",
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 1000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimit",
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed: SQL injection protection
        {
          name: "SQLInjection",
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesSQLiRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "SQLInjection",
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed: common exploits (XSS, bad bots, path traversal)
        {
          name: "CommonExploits",
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "CommonExploits",
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed: known bad inputs
        {
          name: "KnownBadInputs",
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "KnownBadInputs",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Associate WAF with ALB
    new wafv2.CfnWebACLAssociation(this, "WafAlbAssociation", {
      resourceArn: this.alb.loadBalancerArn,
      webAclArn: waf.attrArn,
    });

    // Outputs
    new cdk.CfnOutput(this, "AlbDns", { value: this.alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new cdk.CfnOutput(this, "WafWebAclArn", { value: waf.attrArn });
  }
}
