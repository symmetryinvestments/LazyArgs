import {Browser, chromium, Page, ElementHandle} from "playwright";
import { Command } from "commander";

export async function identity(input: any): Promise<any> {
	return input;
}

export async function innerText(el: ElementHandle): Promise<any> {
	return el !== null && el !== undefined
		? await el.innerText()
		: "";
}

export class E2E2DError extends Error {
	constructor(msg: string) {
		super(msg);
		Object.setPrototypeOf(this, E2E2DError.prototype);
	}
}

export class E2E2DShouldError extends E2E2DError {
	constructor(msg: string, public shld: Should) {
		super(msg);
		Object.setPrototypeOf(this, E2E2DShouldError.prototype);
	}
}

const greenTick = "\t\t\x1b[32m✓\x1b[0m ";
const redCross = "\t\t\x1b[31m⨯\x1b[0m ";

function buildConsoleText(worked: boolean, rest: string[]) {
	let ret = worked ? greenTick : redCross;
	return ret + rest.join(" ");
}

export class Should {
	el: any;
	msg: string[];

	constructor(public U: E2E2D) {
		this.msg = ["You"];
	}

	see(selector: string = "", docName: string = "") {
		this.msg.push("see");
		this.msg.push(docName !== "" ? docName : selector);
		try {
			this.el = this.U.page.$(selector);
		} catch(e) {
			console.log(e);
		}
		return this;
	}

	get observe(): Should {
		this.msg.push("observe");
		return this;
	}

	that(thing: any): Should {
		this.msg.push("that");
		this.el = thing;
		return this;
	}

	get is(): Should {
		this.msg.push("is");
		return this;
	}

	async equals(toCmpAgainst: any, transform: (input: any) => any = identity): Promise<Should> {
		this.msg.push("equals");
		const v = Promise.resolve(this.el) == this.el
			? await transform(await this.el)
			: await transform(this.el);

		if(v !== toCmpAgainst) {
			throw new E2E2DShouldError("Equals " + v + " " + toCmpAgainst, this);
		}
		this.U.printMsg(buildConsoleText(true, this.msg))
		return this;
	}

	async equal(toCmpAgainst: any, transform: (input: any) => any = identity): Promise<Should> {
		this.msg.push("equal");
		const v = Promise.resolve(this.el) == this.el
			? await transform(await this.el)
			: await transform(this.el);

		if(v !== toCmpAgainst) {
			throw new E2E2DShouldError("Equal " + v + " " + toCmpAgainst, this);
		}
		this.U.printMsg(buildConsoleText(true, this.msg))
		return this;
	}

	get to(): Should {
		this.msg.push("to");
		return this;
	}

	async exist(): Promise<Should> {
		this.msg.push("exist");
		const v = Promise.resolve(this.el) == this.el
			? await this.el
			: this.el;
		if(v === null || v === undefined) {
			throw new E2E2DShouldError("Exist", this);
		}
		this.U.printMsg(buildConsoleText(true, this.msg))
		return this;
	}
}

export class E2E2DConfig {
	headless: boolean = false;
	slowMo: number = 300;
	screenX: number = 1920;
	screenY: number = 1080;
}

function fillUpConfig(): E2E2DConfig {
	const ret = new E2E2DConfig();
	const prog = new Command();
	for(const key of Object.getOwnPropertyNames(ret)) {
		prog.option(`--${key}`);
	}
	prog.parse(process.argv);
	console.log(prog);
	return ret;
}

export class E2E2D {
	conf: E2E2DConfig;
	constructor(public browser: Browser, public page: Page) {
		this.conf = fillUpConfig();
	}

	printMsg(msg: string) {
		console.log(msg);
	}

	handleError(e: Error, fun: string, msg: string = "") {
		this.printMsg("\t\t" + `You ${fun}${msg !== "" ? " " + msg : ""} failed`);
		this.printMsg("\t\t\twith error");
		this.printMsg(e.message);
		throw e;
	}

	async navTo(url: string) {
		try {
			await this.page.goto(url);
		} catch(e) {
			this.handleError(e, "navTo", `'${url}'`);
		}
		this.printMsg(`${greenTick}You navigate to ${url}`);
	}

	async fill(selector: string, value: string) {
		try {
			await this.page.fill(selector, value);
		} catch(e) {
			this.handleError(e, "fill", `'${selector}' with '${value}'`);
		}
		this.printMsg(`${greenTick}You insert ${value} into ${selector}`);
	}

	async leftClick(selector: string) {
		try {
			await this.page.click(selector);
		} catch(e) {
			this.handleError(e, "leftClick", `on '${selector}'`)
		}
		this.printMsg(`${greenTick}You left click ${selector}`);
	}

	get should() {
		return new Should(this);
	}
}

async function impl(desc: string): Promise<E2E2D> {
	const browser = await chromium.launch({ headless: false, slowMo: 300});
	const page = await browser.newPage();
	let ret = new E2E2D(browser, page);
	return ret;
}

export async function InOrderTo(desc: string, ...chain: any[]): Promise<any> {
	console.log("\t"+ desc + ":");
	const data: E2E2D = await impl(desc);
	let chained: E2E2D = data;
	for(const f of chain) {
		try {
			chained = await f(chained);
		} catch(e) {
			if(e instanceof E2E2DShouldError) {
				console.log(buildConsoleText(false, e.shld.msg));
			} else if(e instanceof Error) {
				console.log("Error:" + e);
			} else {
				console.log("Error Rest: " + e);
			}
			break;
		}
	}
	data.browser.close();
	return data;
}

