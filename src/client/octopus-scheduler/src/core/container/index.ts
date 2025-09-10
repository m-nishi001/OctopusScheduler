import { ScheduleEventRepository } from '../../model/infrastructures/schedule-event/schedule-event-repository';
import type { IAssetRepository } from '../../model/domains/assets/repository/asset-repository';
import type { IScheduleEventRepository } from '../../model/domains/schedule-event/repository/schedule-event-repository';
import { AssetRepository } from '../../model/infrastructures/assets/asset-repository';
import { container } from 'tsyringe';

export class Container {

  static Register() {
    container.register<IAssetRepository>("IAssetRepository", { useClass: AssetRepository });
    container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: ScheduleEventRepository });
  }

}