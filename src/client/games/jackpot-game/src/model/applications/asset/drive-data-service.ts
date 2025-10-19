import { injectable, inject } from "tsyringe";
import type { IDriveDataRepository } from "../../domains/drive-data/repository/i-drive-data-repository";
import { DriveDataDto } from "./dto/drive-data-dto";
import { FileUtils } from "../../infrastructures/utils/file-utils";
import type {
  DriveData,
  DriveMetadata,
} from "../../../../../../../server/common/src/drive-types";

@injectable()
export class DriveDataService {
  constructor(
    @inject("IDriveDataRepository") private repo: IDriveDataRepository
  ) {}

  async getAllDriveData(): Promise<DriveDataDto[]> {
    const driveData = await this.repo.getDriveData();
    return driveData.map((d) => new DriveDataDto(d));
  }

  async getDriveDataById(id: string): Promise<DriveDataDto | null> {
    const driveData = await this.repo.getDriveDataById(id);
    return driveData ? new DriveDataDto(driveData) : null;
  }

  async addDriveData(
    driveDataDtos: DriveDataDto[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<DriveDataDto[]> {
    const driveDataEntities = await Promise.all(
      driveDataDtos.map((dto) => dto.toDriveData())
    );
    const ids = await this.repo.addDriveData(driveDataEntities, onProgress);
    const updatedDriveDataDtos = ids.map((id, index) => {
      const updatedDriveData: DriveData = {
        ...driveDataEntities[index],
        metadata: {
          ...driveDataEntities[index].metadata,
          driveDataId: id,
        },
      };
      return new DriveDataDto(updatedDriveData);
    });
    return updatedDriveDataDtos;
  }

  async deleteDriveData(
    ids: string[],
    onProgress?: (result: { id: string; success: boolean }) => void
  ): Promise<void> {
    await this.repo.deleteDriveData(ids);
    ids.forEach((id) => onProgress?.({ id, success: true }));
  }

  async syncDriveData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }> {
    return await this.repo.syncDriveData(onProgress);
  }

  public getAllDriveDataMetadata(): Promise<DriveMetadata[]> {
    return this.repo.getAllDriveDataMetadata();
  }

  async createDriveDataDtoFromFile(file: File): Promise<DriveDataDto> {
    const dataUrl = await FileUtils.readAsDataUrl(file);
    const driveData: DriveData = {
      metadata: {
        driveDataId: "",
        fileId: "",
        parentFolderId: "",
        lastUpdate: new Date(),
      },
      fileName: file.name,
      fileKind: file.type,
      fileDataUrl: dataUrl,
      uploadDate: new Date(),
      parentFolderId: "",
    };
    return new DriveDataDto(driveData);
  }

  /**
   * Create a DriveDataDto from a File and also return the Blob (File) itself.
   * This allows UI code to show previews using URL.createObjectURL(blob) instead
   * of relying on base64 data URLs. The existing createDriveDataDtoFromFile
   * is left intact for backwards compatibility.
   */
  async createDriveDataDtoWithBlobFromFile(
    file: File
  ): Promise<{ dto: DriveDataDto; blob: Blob }> {
    const dataUrl = await FileUtils.readAsDataUrl(file);
    const driveData: DriveData = {
      metadata: {
        driveDataId: "",
        fileId: "",
        parentFolderId: "",
        lastUpdate: new Date(),
      },
      fileName: file.name,
      fileKind: file.type,
      fileDataUrl: dataUrl,
      uploadDate: new Date(),
      parentFolderId: "",
    };
    return { dto: new DriveDataDto(driveData), blob: file };
  }
}
