import { injectable } from "tsyringe";
import { GasService } from "./core/gas-service";
import { SuccessResponse } from "../adapter/response/success-response";
import { runDriveServiceTest } from "../infrastructure/google-drvie/example";

@injectable()
export class TestService implements GasService {

    serviceName: string = "TestService";
    functions: Record<string, (args: any) => any>;

    constructor() {
        this.functions = {
            "fooFunc": this.fooFunc
        }
    }

    fooFunc(arg: string): any {

        // const spreadsheetId = "1CsbGHLha756BEp-J9FAJBgeaP7eSdh6SCVr2sUo-qC0";
        // const mapper = new MemberMapper();
        // const repository = new SpreadsheetRepository<IMember, string>(spreadsheetId, "シート1", mapper, 0);
        // const memberRepository = new MemberRepository(repository);
        // const createdMember = memberRepository.create(new Member("001", "Taro", "example@maill.com"));
        // memberRepository.update(createdMember.id, {name: "Jiro"});
        // memberRepository.readAll().forEach(member => Logger.log(JSON.stringify(member)));

        runDriveServiceTest()

        return new SuccessResponse(`fooFunc called with: ${arg}`);
    }

}