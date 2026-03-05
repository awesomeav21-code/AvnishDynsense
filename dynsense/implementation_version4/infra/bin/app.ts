#!/usr/bin/env node
// Ref: ARCHITECTURE 1.md §6.1 — 6 CDK stacks for DynSense infrastructure
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack.js";
import { SecurityStack } from "../lib/security-stack.js";
import { DataStack } from "../lib/data-stack.js";
import { ComputeStack } from "../lib/compute-stack.js";
import { FrontendStack } from "../lib/frontend-stack.js";
import { MonitoringStack } from "../lib/monitoring-stack.js";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env["CDK_DEFAULT_ACCOUNT"],
  region: process.env["CDK_DEFAULT_REGION"] ?? "us-east-1",
};

// 1. Network — VPC, subnets, security groups
const network = new NetworkStack(app, "DynsenseNetwork", { env });

// 2. Security — KMS keys, Secrets Manager
const security = new SecurityStack(app, "DynsenseSecurity", { env });

// 3. Data — RDS, Redis, S3
const data = new DataStack(app, "DynsenseData", {
  env,
  vpc: network.vpc,
  dbSecurityGroup: network.dbSecurityGroup,
  redisSecurityGroup: network.redisSecurityGroup,
  encryptionKey: security.encryptionKey,
  dbCredentials: security.dbCredentials,
});

// 4. Compute — ECS Fargate, ALB
const compute = new ComputeStack(app, "DynsenseCompute", {
  env,
  vpc: network.vpc,
  appSecurityGroup: network.appSecurityGroup,
  dbEndpoint: data.dbEndpoint,
  dbCredentials: security.dbCredentials,
  jwtSecret: security.jwtSecret,
  githubWebhookSecret: security.githubWebhookSecret,
});

// 5. Frontend — CloudFront CDN in front of ALB (Next.js standalone on ECS)
const frontend = new FrontendStack(app, "DynsenseFrontend", {
  env,
  alb: compute.alb,
});

// 6. Monitoring — CloudWatch dashboards, alarms
const monitoring = new MonitoringStack(app, "DynsenseMonitoring", {
  env,
  service: compute.service,
  alb: compute.alb,
  database: data.database,
});

// Stack dependencies (deploy order)
data.addDependency(network);
data.addDependency(security);
compute.addDependency(data);
frontend.addDependency(compute);
monitoring.addDependency(compute);
