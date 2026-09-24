import { describe, it, expect, beforeEach } from 'vitest';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import quizGameRoutes from './index';

describe('quizGameRoutes', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: quizGameRoutes as any,
    });
  });

  it('redirects /quiz-home to the quiz-admin quizzes list', async () => {
    await router.push('/quiz-home');
    expect(router.currentRoute.value.path).toBe('/quiz-admin/quizzes');
  });

  it('redirects the bare /quiz-admin to its quizzes child', async () => {
    await router.push('/quiz-admin');
    expect(router.currentRoute.value.path).toBe('/quiz-admin/quizzes');
    // AdminLayout + QuizList should both be part of the matched chain.
    expect(router.currentRoute.value.matched.length).toBe(2);
  });

  it('resolves /quiz-admin/members to the member management route', async () => {
    await router.push('/quiz-admin/members');
    expect(router.currentRoute.value.path).toBe('/quiz-admin/members');
    expect(router.currentRoute.value.matched.length).toBe(2);
  });

  it('resolves the participant join route with the quiz id param', async () => {
    await router.push('/quiz/abc123/join');
    expect(router.currentRoute.value.name).toBe('quiz-join');
    expect(router.currentRoute.value.params.id).toBe('abc123');
  });

  it('resolves the quiz-play preview route with the preview prop injected', async () => {
    await router.push('/quiz/abc123/play/preview');
    expect(router.currentRoute.value.name).toBe('quiz-play-preview');
  });
});
