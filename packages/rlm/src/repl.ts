import { getQuickJS, type QuickJSContext, type QuickJSRuntime } from "quickjs-emscripten";

interface REPLResult {
	stdout: string;
	stderr: string;
}

export class REPL {
	private runtime: QuickJSRuntime | null = null;
	private vm: QuickJSContext | null = null;
	private llmResponses: string[] = [];
	private llmIdx = 0;
	private stdout: string[] = [];

	async init(memoryLimitMB = 128): Promise<void> {
		const QuickJS = await getQuickJS();
		this.runtime = QuickJS.newRuntime();
		this.runtime.setMemoryLimit(memoryLimitMB * 1024 * 1024);
		this.vm = this.runtime.newContext();

		this.injectGlobals();
	}

	private injectGlobals(): void {
		const vm = this.vm!;

		// Inject llm_query — host bridge for sub-LLM calls
		const llmFn = vm.newFunction("llm_query", (...args) => {
			const prompt = args[0] ? vm.getString(args[0]) : "";
			const response = this.llmResponses[this.llmIdx] ?? "Error: No LLM response available";
			this.llmIdx++;
			return vm.newString(response);
		});
		vm.setProp(vm.global, "llm_query", llmFn);
		llmFn.dispose();

		// Inject FINAL(answer)
		const finalFn = vm.newFunction("FINAL", (...args) => {
			const answer = args[0] ? vm.getString(args[0]) : "";
			vm.setProp(vm.global, "__rlm_final", vm.newString(answer));
		});
		vm.setProp(vm.global, "FINAL", finalFn);
		finalFn.dispose();

		// Inject FINAL_VAR(varName)
		const finalVarFn = vm.newFunction("FINAL_VAR", (...args) => {
			const name = args[0] ? vm.getString(args[0]) : "";
			const val = vm.getProp(vm.global, name);
			if (vm.typeof(val) !== "undefined") {
				const dumped = vm.dump(val);
				vm.setProp(vm.global, "__rlm_final", vm.newString(String(dumped)));
			}
			val.dispose();
		});
		vm.setProp(vm.global, "FINAL_VAR", finalVarFn);
		finalVarFn.dispose();

		// Inject console.log — captures output to this.stdout
		const consoleObj = vm.newObject();
		const logFn = vm.newFunction("log", (...args) => {
			const parts = args.map((h) => {
				const dumped = vm.dump(h);
				return typeof dumped === "string" ? dumped : JSON.stringify(dumped);
			});
			this.stdout.push(parts.join(" "));
		});
		vm.setProp(consoleObj, "log", logFn);
		logFn.dispose();
		vm.setProp(vm.global, "console", consoleObj);
		consoleObj.dispose();

		// Initialize __rlm_final marker
		vm.setProp(vm.global, "__rlm_final", vm.null);
	}

	loadContext(context: string): void {
		const vm = this.vm!;
		vm.setProp(vm.global, "context", vm.newString(context));
	}

	getVariable(name: string): string | undefined {
		const vm = this.vm;
		if (!vm) return undefined;
		const val = vm.getProp(vm.global, name);
		if (vm.typeof(val) === "undefined") {
			val.dispose();
			return undefined;
		}
		const dumped = vm.dump(val);
		val.dispose();
		if (dumped === undefined || dumped === null) return undefined;
		return typeof dumped === "string" ? dumped : JSON.stringify(dumped);
	}

	execute(code: string, llmResponses: string[] = []): REPLResult {
		const vm = this.vm!;

		this.llmResponses = llmResponses;
		this.llmIdx = 0;
		this.stdout = [];

		// Reset __rlm_final
		vm.setProp(vm.global, "__rlm_final", vm.null);

		const result = vm.evalCode(code);

		// Check for FINAL output first
		const finalVal = vm.getProp(vm.global, "__rlm_final");
		const finalDumped = vm.dump(finalVal);
		finalVal.dispose();
		if (finalDumped !== null && finalDumped !== undefined) {
			return { stdout: String(finalDumped), stderr: "" };
		}

		// Handle error
		if (result.error) {
			const errorDumped = vm.dump(result.error);
			result.error.dispose();
			const errorMsg =
				typeof errorDumped === "string"
					? errorDumped
					: errorDumped?.message || JSON.stringify(errorDumped);
			return { stdout: "", stderr: `Error: ${errorMsg}` };
		}

		// Collect output
		const consoleOutput = this.stdout.join("\n");
		const evalResult = vm.dump(result.value);
		result.value.dispose();

		// Prefer console.log output, fall back to eval result
		let stdout = consoleOutput;
		if (!stdout && evalResult !== undefined && evalResult !== null) {
			stdout = typeof evalResult === "string" ? evalResult : JSON.stringify(evalResult);
		}

		return { stdout: stdout || "", stderr: "" };
	}

	dispose(): void {
		if (this.vm) {
			this.vm.dispose();
			this.vm = null;
		}
		if (this.runtime) {
			this.runtime.dispose();
			this.runtime = null;
		}
	}
}
