// Ref: ARCHITECTURE 1.md §6.1 — NetworkStack: VPC, subnets, security groups
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import type { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly appSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with 2 AZs (cost-optimized for internal use)
    this.vpc = new ec2.Vpc(this, "DynsenseVpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: "Isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // Application Security Group (ECS tasks)
    this.appSecurityGroup = new ec2.SecurityGroup(this, "AppSg", {
      vpc: this.vpc,
      description: "ECS Fargate tasks — API + AI engine",
      allowAllOutbound: true,
    });

    // Database Security Group (RDS)
    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DbSg", {
      vpc: this.vpc,
      description: "RDS PostgreSQL 16",
      allowAllOutbound: false,
    });
    this.dbSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow PostgreSQL from ECS tasks",
    );

    // Redis Security Group
    this.redisSecurityGroup = new ec2.SecurityGroup(this, "RedisSg", {
      vpc: this.vpc,
      description: "ElastiCache Redis Serverless",
      allowAllOutbound: false,
    });
    this.redisSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow Redis from ECS tasks",
    );

    // Outputs
    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
  }
}
