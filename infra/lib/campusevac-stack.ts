import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import {
  aws_appsync as appsync,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_s3 as s3,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class CampusEvacStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const drillTable = new dynamodb.Table(this, "DrillTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    drillTable.addGlobalSecondaryIndex({
      indexName: "ByDrillId",
      partitionKey: { name: "drillId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "recordType", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const audioBucket = new s3.Bucket(this, "PhraseAudio", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPool = new cognito.UserPool(this, "DrillUsers", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const userPoolClient = userPool.addClient("WebClient", {
      generateSecret: false,
    });

    const handlerDefaults = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(15),
      bundling: { minify: true, sourceMap: true },
      environment: {
        TABLE_NAME: drillTable.tableName,
        RULES_VERSION: "score-v1",
        SCENARIO_VERSION: "campus-block-v1",
        BEDROCK_MODEL_ID:
          process.env.BEDROCK_MODEL_ID ??
          "anthropic.claude-3-5-sonnet-20241022-v2:0",
        POLLY_VOICE_ID: process.env.POLLY_VOICE_ID ?? "Joanna",
        POLLY_ENGINE: process.env.POLLY_ENGINE ?? "neural",
        AUDIO_BUCKET_NAME: audioBucket.bucketName,
        POLLY_ENABLED: "true",
      },
    } satisfies Omit<nodejs.NodejsFunctionProps, "entry">;

    const commandHandler = new nodejs.NodejsFunction(this, "CommandHandler", {
      ...handlerDefaults,
      entry: path.join(__dirname, "../src/handlers/appsync.ts"),
      description: "Validates drill membership, commands, and role-scoped events.",
    });
    const aarHandler = new nodejs.NodejsFunction(this, "AarHandler", {
      ...handlerDefaults,
      entry: path.join(__dirname, "../src/handlers/aar.ts"),
      description: "Calculates a deterministic three-question after-action report.",
    });
    const scenarioHandler = new nodejs.NodejsFunction(this, "ScenarioHandler", {
      ...handlerDefaults,
      entry: path.join(__dirname, "../src/handlers/scenario.ts"),
      description: "Proposes a bounded scenario and falls back to the authored seed.",
    });
    const speechHandler = new nodejs.NodejsFunction(this, "SpeechHandler", {
      ...handlerDefaults,
      entry: path.join(__dirname, "../src/handlers/speech.ts"),
      description: "Caches short Polly phrases while preserving captions.",
    });

    for (const handler of [commandHandler, aarHandler, scenarioHandler])
      drillTable.grantReadWriteData(handler);
    audioBucket.grantPut(speechHandler);
    speechHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["polly:SynthesizeSpeech"],
        resources: ["*"],
      }),
    );
    scenarioHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:Converse", "bedrock:InvokeModel"],
        resources: ["*"],
      }),
    );

    const api = new appsync.GraphqlApi(this, "DrillApi", {
      name: `${this.stackName.toLowerCase()}-api`,
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, "../schema.graphql")),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
      },
    });

    const commandSource = api.addLambdaDataSource("CommandDataSource", commandHandler);
    const aarSource = api.addLambdaDataSource("AarDataSource", aarHandler);
    const scenarioSource = api.addLambdaDataSource("ScenarioDataSource", scenarioHandler);
    const speechSource = api.addLambdaDataSource("SpeechDataSource", speechHandler);

    commandSource.createResolver("DrillResolver", { typeName: "Query", fieldName: "drill" });
    aarSource.createResolver("AarResolver", {
      typeName: "Query",
      fieldName: "afterActionReport",
    });
    for (const fieldName of [
      "createDrill",
      "joinDrill",
      "startDrill",
      "submitIntent",
      "leaveDrill",
      "publishDrillEvent",
    ]) {
      commandSource.createResolver(`${fieldName}Resolver`, {
        typeName: "Mutation",
        fieldName,
      });
    }
    scenarioSource.createResolver("GenerateScenarioResolver", {
      typeName: "Mutation",
      fieldName: "generateScenario",
    });
    speechSource.createResolver("SpeakPhraseResolver", {
      typeName: "Mutation",
      fieldName: "speakPhrase",
    });

    new cdk.CfnOutput(this, "GraphqlUrl", { value: api.graphqlUrl });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "DrillTableName", { value: drillTable.tableName });
    new cdk.CfnOutput(this, "PhraseAudioBucket", { value: audioBucket.bucketName });
  }
}
