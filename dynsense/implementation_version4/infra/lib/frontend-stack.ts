// Ref: ARCHITECTURE 1.md §1.2 — FrontendStack: CloudFront CDN in front of ALB
// Next.js runs in standalone mode on ECS (same cluster as API) because
// the app uses dynamic [id] routes that require a Node.js server.
// S3 bucket is retained for static asset uploads (images, files).
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import type { Construct } from "constructs";

interface FrontendStackProps extends cdk.StackProps {
  alb: elbv2.ApplicationLoadBalancer;
}

export class FrontendStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly assetsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // --- S3 Bucket for static uploads (images, attachments) ---
    this.assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      bucketName: `dynsense-assets-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- CloudFront Distribution (CDN in front of ALB) ---
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI");
    this.assetsBucket.grantRead(oai);

    this.distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      // Default: all traffic goes to ALB (Next.js standalone server)
      defaultBehavior: {
        origin: new origins.HttpOrigin(props.alb.loadBalancerDnsName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      // Static assets from S3 (Next.js _next/static, uploads)
      additionalBehaviors: {
        "/_next/static/*": {
          origin: new origins.S3Origin(this.assetsBucket, { originAccessIdentity: oai }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        "/assets/*": {
          origin: new origins.S3Origin(this.assetsBucket, { originAccessIdentity: oai }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Outputs
    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "AssetsBucketName", { value: this.assetsBucket.bucketName });
  }
}
