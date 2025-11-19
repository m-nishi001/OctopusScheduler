import { GasFunctionService } from '@common-lib/google-apps-script/gas-script-service';
import type { IPrizeRepository } from '@model/domains/prize/repository/i-prize-repository';
// no direct dependency on AssetDataService in this helper; asset handling is done in services

const PRIZE_STORAGE_KEY = 'jackpot-game-prizes-json';

export const savePrizesToLocalJson = async (prizes: any[]) => {
  try {
    const payload = JSON.stringify(prizes || []);
    localStorage.setItem(PRIZE_STORAGE_KEY, payload);
  } catch (e) {
    console.error('Failed to save prizes JSON to localStorage', e);
  }
};

export const uploadPrizesJsonToDrive = async (prizes: any[]) => {
  try {
    const json = JSON.stringify(prizes || []);
    const service = new GasFunctionService('addJson');
    const driveJson = {
      metadata: {
        driveDataId: 'prizes-json-' + Date.now(),
        fileId: '',
        parentFolderId: '',
        lastUpdate: new Date().toISOString(),
        size: json.length,
      },
      fileName: 'prizes.json',
      jsonText: json,
      uploadDate: new Date().toISOString(),
      parentFolderId: '',
    };
    const res = await service.call<any>(driveJson);
    const fileId = res?.fileId || res?.data?.fileId;
    if (fileId) {
      localStorage.setItem('jackpot-prizes-last-file-id', fileId);
      console.log('Uploaded prizes.json fileId=', fileId);
    }
  } catch (e) {
    console.error('Failed to upload prizes JSON via GAS', e);
  }
};

export const downloadPrizesJsonFromDrive = async (prizeRepo: IPrizeRepository) => {
  try {
    const lastId = localStorage.getItem('jackpot-prizes-last-file-id');
    if (!lastId) {
      console.warn('No last uploaded prizes file id saved');
      return;
    }
    const service = new GasFunctionService('getJson');
    const resp = await service.call<{ json: string } | null>(lastId);
    if (resp && resp.json) {
      const json = resp.json;
      localStorage.setItem(PRIZE_STORAGE_KEY, json);
      try {
        const parsed = JSON.parse(json || '[]');
        if (Array.isArray(parsed)) {
          try {
            await prizeRepo.replaceAllPrizes(parsed as any);
          } catch (e) {
            console.error('Failed to persist prizes into local repo:', e);
          }
          return parsed as any[];
        } else {
          console.warn('Downloaded prizes JSON is not an array');
        }
      } catch (e) {
        console.error('Failed to parse downloaded prizes JSON', e);
      }
    }
  } catch (e) {
    console.error('Failed to download prizes JSON via GAS', e);
  }
};
