// import { createRouter, createWebHistory } from 'vue-router'; // Vue 3の場合
// // import VueRouter from 'vue-router'; // Vue 2の場合
// // import Vue from 'vue'; // Vue 2の場合

// // Vue 2の場合:
// // Vue.use(VueRouter);

// // 1. ルートコンポーネントのインポート
// import Home from '../views/Home.vue';
// import About from '../views/About.vue';
// import NotFound from '../views/NotFound.vue'; // 存在しないパス用のコンポーネント

// // 2. ルートの定義
// // それぞれのルートはパスとコンポーネントのマッピングを定義します。
// const routes = [
//   {
//     path: '/',
//     name: 'Home',
//     component: Home,
//   },
//   {
//     path: '/about',
//     name: 'About',
//     // ルートベースのコード分割 (Route-level code-splitting)
//     // これにより、このルートが訪問されたときにのみ、対応するコンポーネントのチャンクがロードされます。
//     component: () => import(/* webpackChunkName: "about" */ '../views/About.vue'),
//   },
//   // 404 Not Found のルート (常に最後に配置)
//   {
//     path: '/:pathMatch(.*)*', // Vue Router 4 (Vue 3) の構文
//     // path: '*', // Vue Router 3 (Vue 2) の構文
//     name: 'NotFound',
//     component: NotFound,
//   },
// ];

// // 3. ルーターインスタンスの作成
// // Vue 3の場合:
// const router = createRouter({
//   history: createWebHistory(), // HTML5 History モードを使用
//   routes, // 上で定義したルート
// });

// // Vue 2の場合:
// // const router = new VueRouter({
// //   mode: 'history', // HTML5 History モードを使用
// //   routes,
// // });

// // 4. ルーターインスタンスのエクスポート
// export default router;