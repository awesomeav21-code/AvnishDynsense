// Ref: ARCHITECTURE 1.md §7 — MonitoringStack: CloudWatch dashboards, alarms
import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sns from "aws-cdk-lib/aws-sns";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import type { Construct } from "constructs";

interface MonitoringStackProps extends cdk.StackProps {
  service: ecs.FargateService;
  alb: elbv2.ApplicationLoadBalancer;
  database: rds.DatabaseInstance;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // --- SNS Topic for alerts ---
    const alertTopic = new sns.Topic(this, "AlertTopic", {
      topicName: "dynsense-alerts",
      displayName: "DynSense Infrastructure Alerts",
    });

    // --- ECS CPU Alarm (>80% for 5 min) ---
    const ecsCpuAlarm = new cloudwatch.Alarm(this, "EcsCpuAlarm", {
      metric: props.service.metricCpuUtilization(),
      threshold: 80,
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "ECS CPU > 80% sustained — consider adding 2nd task",
    });
    ecsCpuAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // --- ECS Memory Alarm (>80% for 5 min) ---
    const ecsMemoryAlarm = new cloudwatch.Alarm(this, "EcsMemoryAlarm", {
      metric: props.service.metricMemoryUtilization(),
      threshold: 80,
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "ECS Memory > 80% sustained",
    });
    ecsMemoryAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // --- RDS CPU Alarm (>80% for 5 min) ---
    const rdsCpuAlarm = new cloudwatch.Alarm(this, "RdsCpuAlarm", {
      metric: props.database.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "RDS CPU > 80% sustained",
    });
    rdsCpuAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // --- RDS Connections Alarm (>90% of max) ---
    const rdsConnectionsAlarm = new cloudwatch.Alarm(this, "RdsConnectionsAlarm", {
      metric: props.database.metricDatabaseConnections(),
      threshold: 90, // db.t4g.small max ~85 connections
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "RDS connections > 90% of max capacity",
    });
    rdsConnectionsAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // --- ALB 5xx Error Rate Alarm (>5% for 5 min) ---
    const alb5xxAlarm = new cloudwatch.Alarm(this, "Alb5xxAlarm", {
      metric: props.alb.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
        period: cdk.Duration.minutes(1),
        statistic: "Sum",
      }),
      threshold: 10,
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "ALB 5xx errors > 10/min sustained — API error rate high",
    });
    alb5xxAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // --- ALB p95 Latency Alarm (>500ms for 10 min) ---
    const albLatencyAlarm = new cloudwatch.Alarm(this, "AlbLatencyAlarm", {
      metric: props.alb.metrics.targetResponseTime({
        period: cdk.Duration.minutes(1),
        statistic: "p95",
      }),
      threshold: 0.5, // 500ms in seconds
      evaluationPeriods: 10,
      datapointsToAlarm: 6,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "ALB p95 latency > 500ms sustained",
    });
    albLatencyAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // --- CloudWatch Dashboard ---
    const dashboard = new cloudwatch.Dashboard(this, "DynsenseDashboard", {
      dashboardName: "DynSense-Operations",
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "ECS CPU & Memory",
        left: [props.service.metricCpuUtilization()],
        right: [props.service.metricMemoryUtilization()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "RDS CPU & Connections",
        left: [props.database.metricCPUUtilization()],
        right: [props.database.metricDatabaseConnections()],
        width: 12,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "ALB Request Count & Latency",
        left: [props.alb.metrics.requestCount()],
        right: [props.alb.metrics.targetResponseTime({ statistic: "p95" })],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "ALB Error Rates",
        left: [
          props.alb.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_4XX_COUNT),
          props.alb.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT),
        ],
        width: 12,
      }),
    );

    // Outputs
    new cdk.CfnOutput(this, "AlertTopicArn", { value: alertTopic.topicArn });
    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=DynSense-Operations`,
    });
  }
}
