import { container } from "tsyringe";

export class ApiHandler {
  static handle(functionName: string, args: any) {
    try {
      const [serviceName, method] = functionName.split(".");
      const service: any = container.resolve(serviceName);
      if (!service || typeof service[method] !== "function") {
        return { status: "error", message: `no handler for ${functionName}` };
      }
      const result = service[method](...(args || []));
      return { status: "success", data: result };
    } catch (e: any) {
      return { status: "error", message: e?.message || String(e) };
    }
  }
}
