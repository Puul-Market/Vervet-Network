import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
    process.env.ADMIN_API_TOKEN = 'test-admin-token';
    process.env.WEBHOOK_SIGNING_MASTER_SECRET = 'test-webhook-signing-secret';
    process.env.WEBHOOK_DELIVERY_PROCESSOR_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect((response) => {
        const responseBody: unknown = response.body;

        expect(responseBody).toMatchObject({
          status: true,
          data: {
            service: 'vervet-network-backend',
          },
        });
      });
  });

  it('/attestations (POST) rejects unauthenticated writes', () => {
    return request(app.getHttpServer()).post('/v1/attestations').expect(401);
  });

  it('/attestations (GET) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer()).get('/v1/attestations').expect(401);
  });

  it('/resolution/resolve (POST) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer())
      .post('/v1/resolution/resolve')
      .send({
        recipientIdentifier: 'jane@bybit',
        chain: 'ethereum',
        asset: 'USDC',
      })
      .expect(401);
  });

  it('/resolution/verify (POST) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer())
      .post('/v1/resolution/verify')
      .send({
        recipientIdentifier: 'jane@bybit',
        chain: 'ethereum',
        asset: 'USDC',
        address: '0x8ba1f109551bd432803012645ac136ddd64dba72',
      })
      .expect(401);
  });

  it('/partners (POST) rejects missing admin token', () => {
    return request(app.getHttpServer())
      .post('/v1/partners')
      .send({
        slug: 'unauthorized-partner',
        displayName: 'Unauthorized Partner',
        partnerType: 'EXCHANGE',
      })
      .expect(401);
  });

  it('/webhooks (GET) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer()).get('/v1/webhooks').expect(401);
  });

  it('/webhooks/deliveries (GET) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer())
      .get('/v1/webhooks/deliveries')
      .expect(401);
  });

  it('/webhooks/:endpointId (PATCH) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer())
      .patch('/v1/webhooks/test-endpoint')
      .send({
        status: 'PAUSED',
      })
      .expect(401);
  });

  it('/webhooks/deliveries/process (POST) rejects missing admin token', () => {
    return request(app.getHttpServer())
      .post('/v1/webhooks/deliveries/process')
      .send({
        limit: 10,
      })
      .expect(401);
  });

  it('/audit-logs (GET) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer()).get('/v1/audit-logs').expect(401);
  });

  it('/recipients (GET) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer()).get('/v1/recipients').expect(401);
  });

  it('/recipients/:recipientId (GET) rejects unauthenticated partner access', () => {
    return request(app.getHttpServer())
      .get('/v1/recipients/test-recipient')
      .expect(401);
  });
});
