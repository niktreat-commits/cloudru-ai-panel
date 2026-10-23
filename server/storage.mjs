import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand,ListObjectsV2Command,HeadBucketCommand} from '@aws-sdk/client-s3';
import {NodeHttpHandler} from '@smithy/node-http-handler';

export class ObjectStore{
 constructor(config){
  this.bucket=config.bucket;
  this.client=new S3Client({endpoint:config.endpoint,region:config.region,forcePathStyle:true,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},maxAttempts:2,requestHandler:new NodeHttpHandler({connectionTimeout:3000,requestTimeout:10000}),requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
 }
 async put(key,body,type='application/json'){await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body,null,2),ContentType:type}));}
 async get(key){try{const r=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:key}));return Buffer.from(await r.Body.transformToByteArray());}catch(e){if(e.name==='NoSuchKey'||e.$metadata?.httpStatusCode===404)return null;throw e;}}
 async json(key){const b=await this.get(key);return b?JSON.parse(b.toString('utf8')):null;}
 async remove(key){await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:key}));}
 async *list(prefix){let token;do{const r=await this.client.send(new ListObjectsV2Command({Bucket:this.bucket,Prefix:prefix,ContinuationToken:token}));for(const item of r.Contents||[])yield item.Key;token=r.IsTruncated?r.NextContinuationToken:undefined;}while(token);}
 async head(){await this.client.send(new HeadBucketCommand({Bucket:this.bucket}));}
 close(){this.client.destroy();}
}
