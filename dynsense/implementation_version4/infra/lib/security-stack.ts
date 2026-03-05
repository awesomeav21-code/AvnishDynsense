// Ref: ARCHITECTURE 1.md §5.1 — SecurityStack: Secrets Manager, KMS keys
import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

export class SecurityStack extends cdk.Stack {
  public readonly encryptionKey: kms.Key;
  public readonly dbCredentials: secretsmanager.Secret;
  public readonly jwtSecret: secretsmanager.Secret;
  public readonly githubWebhookSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // KMS Customer Managed Key for encryption at rest (RDS, Redis, S3)
    this.encryptionKey = new kms.Key(this, "DynsenseKmsKey", {
      alias: "dynsense/encryption",
      description: "CMK for DynSense data encryption at rest",
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Database credentials
    this.dbCredentials = new secretsmanager.Secret(this, "DbCredentials", {
      secretName: "dynsense/db-credentials",
      description: "RDS PostgreSQL credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "dynsense" }),
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 32,
      },
      encryptionKey: this.encryptionKey,
    });

    // JWT signing secret
    this.jwtSecret = new secretsmanager.Secret(this, "JwtSecret", {
      secretName: "dynsense/jwt-secret",
      description: "JWT HS256 signing secret",
      generateSecretString: {
        excludePunctuation: false,
        passwordLength: 64,
      },
      encryptionKey: this.encryptionKey,
    });

    // GitHub webhook secret
    this.githubWebhookSecret = new secretsmanager.Secret(this, "GithubWebhookSecret", {
      secretName: "dynsense/github-webhook-secret",
      description: "GitHub App webhook signature verification",
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 40,
      },
      encryptionKey: this.encryptionKey,
    });

    // Outputs
    new cdk.CfnOutput(this, "KmsKeyArn", { value: this.encryptionKey.keyArn });
  }
}
