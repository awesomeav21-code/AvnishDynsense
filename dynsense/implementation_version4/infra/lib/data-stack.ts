// Ref: ARCHITECTURE 1.md §1.1 — DataStack: RDS PostgreSQL 16 (Single-AZ), Redis Serverless, S3
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

interface DataStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
  redisSecurityGroup: ec2.SecurityGroup;
  encryptionKey: kms.Key;
  dbCredentials: secretsmanager.Secret;
}

export class DataStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly uploadsBucket: s3.Bucket;
  public readonly dbEndpoint: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // --- RDS PostgreSQL 16 (Single-AZ, db.t4g.small) ---
    this.database = new rds.DatabaseInstance(this, "DynsenseDb", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(props.dbCredentials),
      databaseName: "dynsense",
      multiAz: false, // Single-AZ for cost (internal use, accepted risk)
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      storageEncryptionKey: props.encryptionKey,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      monitoringInterval: cdk.Duration.seconds(60),
    });

    this.dbEndpoint = this.database.dbInstanceEndpointAddress;

    // --- ElastiCache Redis Serverless ---
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, "RedisSubnetGroup", {
      description: "DynSense Redis subnets",
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
    });

    new elasticache.CfnServerlessCache(this, "DynsenseRedis", {
      engine: "redis",
      serverlessCacheName: "dynsense-cache",
      securityGroupIds: [props.redisSecurityGroup.securityGroupId],
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      majorEngineVersion: "7",
      description: "DynSense session cache and rate limiting",
    });

    // Suppress lint warning for unused subnet group (referenced by ARN in serverless cache)
    void redisSubnetGroup;

    // --- S3: Uploads + session transcripts ---
    this.uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `dynsense-uploads-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        { expiration: cdk.Duration.days(365), prefix: "transcripts/" },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Outputs
    new cdk.CfnOutput(this, "DbEndpoint", { value: this.dbEndpoint });
    new cdk.CfnOutput(this, "UploadsBucketName", { value: this.uploadsBucket.bucketName });
  }
}
