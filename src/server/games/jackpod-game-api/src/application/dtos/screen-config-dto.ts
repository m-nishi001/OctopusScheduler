// --- Entity <-> DTO 変換ロジック ---
import type { ScreenConfig, ScreenElement, AnimationSettings } from '../../domain/entities/screen-config';

export function toScreenConfig(dto: ScreenConfigDto): ScreenConfig {
    return {
        type: dto.type,
        bgmAssetId: dto.bgmAssetId,
        seAssetIds: dto.seAssetIds,
        backgroundStyle: dto.backgroundStyle,
        elements: dto.elements.map(toScreenElement),
        animationSettings: dto.animationSettings ? toAnimationSettings(dto.animationSettings) : undefined
    };
}

export function toScreenConfigDto(entity: ScreenConfig): ScreenConfigDto {
    return {
        type: entity.type,
        bgmAssetId: entity.bgmAssetId,
        seAssetIds: entity.seAssetIds,
        backgroundStyle: entity.backgroundStyle,
        elements: entity.elements.map(toScreenElementDto),
        animationSettings: entity.animationSettings ? toAnimationSettingsDto(entity.animationSettings) : undefined
    };
}

export function toScreenElement(dto: ScreenElementDto): ScreenElement {
    return {
        id: dto.id,
        type: dto.type as any,
        content: dto.content,
        assetId: dto.assetId,
        style: dto.style,
        animation: dto.animation ? toAnimationSettings(dto.animation) : undefined
    };
}

export function toScreenElementDto(entity: ScreenElement): ScreenElementDto {
    return {
        id: entity.id,
        type: entity.type as any,
        content: entity.content,
        assetId: entity.assetId,
        style: entity.style,
        animation: entity.animation ? toAnimationSettingsDto(entity.animation) : undefined
    };
}

export function toAnimationSettings(dto: AnimationSettingsDto): AnimationSettings {
    return {
        type: dto.type,
        duration: dto.duration,
        delay: dto.delay,
        params: dto.params
    };
}

export function toAnimationSettingsDto(entity: AnimationSettings): AnimationSettingsDto {
    return {
        type: entity.type,
        duration: entity.duration,
        delay: entity.delay,
        params: entity.params
    };
}
export type ScreenType = 'home' | 'opening' | 'description' | 'demo' | 'main' | 'result' | 'admin';

export interface ScreenConfigDto {
    type: ScreenType;
    bgmAssetId?: string;
    seAssetIds?: string[];
    backgroundStyle: string;
    elements: ScreenElementDto[];
    animationSettings?: AnimationSettingsDto;
}

export interface ScreenElementDto {
    id: string;
    type: 'text' | 'image' | 'video' | 'button' | 'progress' | 'list' | 'modal';
    content?: string;
    assetId?: string;
    style?: string;
    animation?: AnimationSettingsDto;
}

export interface AnimationSettingsDto {
    type: 'fade' | 'zoom' | 'scroll' | 'slide' | 'particle' | 'custom';
    duration?: number;
    delay?: number;
    params?: Record<string, any>;
}
