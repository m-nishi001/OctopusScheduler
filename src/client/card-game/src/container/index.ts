// Container.ts
// import { container } from 'tsyringe';

export function registerDependencies() {

  // 環境変数などに応じて異なる実装を登録する例
  // if (process.env.NODE_ENV === 'production') {
  //   container.register<IEmailService>('IEmailService', { useClass: ProductionEmailService });
  // } else {
  //   container.register<IEmailService>('IEmailService', { useClass: DevelopmentEmailService });
  // }
}

// アプリケーションのエントリポイントで呼び出す
// import { registerDependencies } from './Container';
// registerDependencies();