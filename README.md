<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

TAP Conector es una aplicación NestJS que gestiona **3 conexiones simultáneas a bases de datos** usando Prisma ORM:

- 🔵 **Base de Datos Local** (PostgreSQL/MySQL/SQLite) - Configuración y datos locales
- 🟢 **Base de Datos MySQL Externa** - Productos y catálogos
- 🔴 **Base de Datos SQL Server** - Sistema de órdenes y transacciones

## Características Principales

✅ **Multi-Database Support** - 3 conexiones independientes a diferentes bases de datos
✅ **Prisma ORM** - Type-safe database access con clientes generados automáticamente
✅ **Health Checks** - Endpoints para monitorear el estado de cada base de datos
✅ **Global Services** - Servicios disponibles en toda la aplicación
✅ **Example Module** - Módulo completo de ejemplo con operaciones CRUD
✅ **TypeScript** - Type safety completo en toda la aplicación
✅ **Production Ready** - Logging, error handling y configuración para producción

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your database credentials
```

### 3. Generate Prisma clients

```bash
npm run prisma:generate
```

### 4. Apply database schemas

```bash
# Development (quick push)
npm run prisma:push:local
npm run prisma:push:mysql
npm run prisma:push:sqlserver

# Production (with migrations)
npm run prisma:migrate:local
npm run prisma:migrate:mysql
npm run prisma:migrate:sqlserver
```

### 5. Start the application

```bash
# development mode with hot-reload
npm run start:dev

# production mode
npm run build
npm run start:prod
```

### 6. Verify connections

```bash
# Check all databases
curl http://localhost:3000/health/database

# Get statistics
curl http://localhost:3000/example/statistics
```

## 📚 Documentation

- **[QUICK_START.md](QUICK_START.md)** - Guía de inicio rápido
- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Configuración detallada de bases de datos
- **[API_EXAMPLES.md](API_EXAMPLES.md)** - Ejemplos de uso de la API
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Resumen completo del proyecto
- **[CHECKLIST.md](CHECKLIST.md)** - Checklist de configuración
- **[CONFIGURACION_COMPLETADA.md](CONFIGURACION_COMPLETADA.md)** - Estado de la configuración

## 🏗️ Project Structure

```
tap-conector/
├── prisma/                    # Prisma schemas
│   ├── schema-local.prisma
│   ├── schema-mysql.prisma
│   └── schema-sqlserver.prisma
├── src/
│   ├── database/              # Database module
│   │   ├── services/          # Prisma services
│   │   ├── database.module.ts
│   │   └── database-health.controller.ts
│   ├── example/               # Example module
│   └── app.module.ts
└── .env                       # Environment variables
```

## 🔌 API Endpoints

### Health Checks
- `GET /health/database` - Check all databases
- `GET /health/database/local` - Check local database
- `GET /health/database/mysql` - Check MySQL database
- `GET /health/database/sqlserver` - Check SQL Server database

### Example Endpoints
- `GET /example/all` - Get all data from all databases
- `GET /example/users` - Get users from local database
- `GET /example/products` - Get products from MySQL
- `GET /example/orders` - Get orders from SQL Server
- `GET /example/statistics` - Get statistics from all databases
- `GET /example/search?q=term` - Search across databases
- `POST /example/sync` - Sync product to order

## 🧪 Run tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## 🗄️ Database Scripts

```bash
# Generate Prisma clients
npm run prisma:generate

# Migrations
npm run prisma:migrate:local
npm run prisma:migrate:mysql
npm run prisma:migrate:sqlserver

# Push schemas (development)
npm run prisma:push:local
npm run prisma:push:mysql
npm run prisma:push:sqlserver

# Prisma Studio (GUI)
npm run prisma:studio:local
npm run prisma:studio:mysql
npm run prisma:studio:sqlserver
```

## 💡 Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaLocalService } from './database/services/prisma-local.service';
import { PrismaMysqlService } from './database/services/prisma-mysql.service';
import { PrismaSqlServerService } from './database/services/prisma-sqlserver.service';

@Injectable()
export class MyService {
  constructor(
    private readonly prismaLocal: PrismaLocalService,
    private readonly prismaMysql: PrismaMysqlService,
    private readonly prismaSqlServer: PrismaSqlServerService,
  ) {}

  async getData() {
    // Use local database
    const users = await this.prismaLocal.user.findMany();

    // Use MySQL database
    const products = await this.prismaMysql.product.findMany();

    // Use SQL Server database
    const orders = await this.prismaSqlServer.order.findMany({
      include: { items: true }
    });

    return { users, products, orders };
  }
}
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
