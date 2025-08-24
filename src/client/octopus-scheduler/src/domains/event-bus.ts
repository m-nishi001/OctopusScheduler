import mitt, { type Emitter } from 'mitt';
import type { EventMap } from './schedule/event-types';

/**
 * アプリケーション全体で使用するイベントバスのインスタンス。
 * DOMAIN層で定義されたイベントのみを扱うため、EventMapで型付けする。
 */
export const domainEventBus: Emitter<EventMap> = mitt<EventMap>();