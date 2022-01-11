// @checkJs: true
const OptionMetaDataStore: string = "__lazyArgs";

export type LazyCallback = (nesting: string[], key: string, options: any) => void;

/**
 * The object that stores options about an command line option.
 */
export class LazyArg {
	public callBack: (LazyCallback | null);
	/**
	 * The constructor of the LazyArg
	 * @param propName The property name of the option.
	 * @param shortName The short option name of the option
	 * @param doc Additional documentation of the option
	 */
	constructor(public propName: string, public shortName: string = "", public doc: string = "")
	{
		this.callBack = null;
	}
}

class LazyArgs {
	options: any;
	constructor() {
		this.options = {};
	}
}

function getLazyArg(target: Object, propertyKey: string): LazyArg {
	let pro: Object = Object.prototype;
	if(typeof (getLazyArg as any).__lazyArgs == "undefined") {
		(getLazyArg as any).__lazyArgs = {};
	}

	if(!(getLazyArg as any).__lazyArgs.hasOwnProperty(propertyKey)) {
		(getLazyArg as any).__lazyArgs[propertyKey] = new LazyArg(propertyKey);
	}

	return (getLazyArg as any).__lazyArgs[propertyKey];
}

/**
 * Typescript decorator to assign a short option to a command line option.
 * @param shortName The short option name to use
 */
export const OptionShort = (shortName: string) => (target: Object, propertyKey: string) => {
	let lazyArg: LazyArg = getLazyArg(target, propertyKey);

	lazyArg.shortName = shortName;
};

/**
 * Typescript decorator to assign additional documentation to a command line
 * option.
 * @param doc The documenetaion to assign
 */
export const OptionDoc = (doc: string) => (target: Object, propertyKey: string) => {
	let lazyArg: LazyArg = getLazyArg(target, propertyKey);

	lazyArg.doc = doc;
};

/**
 * Typescript decorator to assign callback option.
 * @param callback The callback to call when this options is found
 */
export const OptionCallback = (callBack: LazyCallback) => (target: Object, propertyKey: string) => {
	let lazyArg: LazyArg = getLazyArg(target, propertyKey);

	lazyArg.callBack = callBack;
};

function getShortName<T extends Object>(obj: T, propName: string): string {
	const lazyArg: LazyArg = getLazyArg(obj, propName);
	return lazyArg.shortName == ""
		? ""
		: "-" + lazyArg.shortName;
}

function getCallback<T extends Object>(obj: T, propName: string): LazyCallback | null {
	const lazyArg: LazyArg = getLazyArg(obj, propName);
	return lazyArg.callBack;
}

function buildDocString<T extends Object>(obj: T, propName: string): string {
	const lazyArg: LazyArg = getLazyArg(obj, propName);
	const prefix = `Type: ${typeof (<any>obj)[propName]}, Default: ${(<any>obj)[propName]}`;
	return lazyArg.doc == ""
		? prefix
		: prefix + " " + lazyArg.doc;
}

/**
 * This functions throws an Error with message `msg` if `cond` is false.
 * @param cond The condition to check
 * @param msg The message to passed to the Error if thrown
 */
export function enforce(cond: boolean, msg: string) {
	if(!cond) {
		throw new Error(msg);
	}
}

/**
 * A class that helps navigating and manipulating process.argv
 */
export class Elem {
	/**
	 * After construction this number either points to the index of the match
	 * in process.argv or is -1 if no match was found in process.argv
	 */
	public idx: number = -1;

	/**
	 * The string that was used in the match, either the short or the long form.
	 * If there was no match the string will equal "".
	 */
	public name: string = "";

	/**
	 * The constructor
	 * @param lName The long name e.g. --foo. Has precedence of sName
	 * @param lIdx The index the lName was found in process.argv. Is -1 if not found
	 * @param sName The short name e.g. -h.
	 * @param lIdx The index the sName was found in process.argv. Is -1 if not found
	 * @param allowMultiple If true it is not enforced that options are unique
	 * in process.argv
	 */
	constructor(public lName: string, public lIdx: number
		, public sName: string, public sIdx: number
		, public allowMultiple: boolean  = false)
	{
		if(!this.allowMultiple) {
			enforce(this.lIdx === -1 || this.sIdx === -1,
				`Found both '${this.lName}' at ${this.lIdx}`
				+ ` and '${this.sName}' at ${this.sIdx} in ${process.argv.join(", ")}`);
		}

		const { i, n } =
			this.lIdx !== -1
				? {i: this.lIdx, n: this.lName}
				: this.sIdx !== -1
					? {i: this.sIdx, n: this.sName}
					: {i: -1, n: ""};

		this.idx = i;
		this.name = n;
	}

	/**
	 *@returns true if neither lName of sName were found in process.argv
	 */
	isEmpty(): boolean {
		return this.idx == -1;
	}

	/**
	 *@returns true if idx + 1 < process.argv.length
	 */
	nextExist(): boolean {
		return this.idx + 1 < process.argv.length;
	}

	/**
	 *@returns true if the element in process.argv[idx + 1] is a boolean
	 */
	nextIsBoolean(): boolean {
		return this.nextExist()
			&& (process.argv[this.idx + 1] === "true"
				|| process.argv[this.idx + 1] === "false");
	}

	/**
	 *@returns tries to return the element in process.args[idx + 1] as a boolean
	 */
	getNextBoolean(): boolean {
		return process.argv[this.idx + 1] === "true";
	}

	/**
	 *@returns tries to return the element in process.args[idx + 1] as a number
	 */
	getNextNumber(): number {
		enforce(this.nextExist(), `To get a number from '${this.name}' at `
			+ `${this.idx} the next element must exist`);
		return parseInt(process.argv[this.idx + 1], 10);
	}

	/**
	 *@returns tries to return the element in process.args[idx + 1] as a string
	 */
	getNextString(): string {
		enforce(this.nextExist(), `To get a string from '${this.name}' at `
			+ `${this.idx} the next element must exist`);
		return process.argv[this.idx + 1];
	}

	/**
	 * @param howMany how many elements should be removed from process.argv
	 * starting at position idx.
	 */
	remove(howMany: 1 | 2) {
		process.argv.splice(this.idx, howMany);
	}
}

export function buildElem<T extends Object>(nesting: string[], key: string
	, resultObject: T): Elem
{
	const lName = `--${[...nesting, key].join(".")}`;
	const lIdx = process.argv.indexOf(lName);
	const sName = getShortName(resultObject, key);
	const sIdx = sName !== "" ? process.argv.indexOf(sName) : -1

	const elem = new Elem(lName, lIdx, sName, sIdx);
	return elem;
}

function fillUpConfig<T extends Object>(resultObject: T, nesting: string[]) {
	for(const key of Object.getOwnPropertyNames(resultObject)) {
		let thing = (<any>resultObject)[key];
		const cb: LazyCallback | null  = getCallback(resultObject, key);
		if(cb !== null) {
			cb(nesting, key, resultObject);
		} else if(typeof thing === "object") {
			fillUpConfig(thing, [...nesting, key]);
		} else {
			const elem = buildElem(nesting, key, resultObject);
			if(elem.isEmpty()) {
				continue;
			}

			if(typeof thing  === "boolean" && elem.nextIsBoolean()) {
				(<any>resultObject)[key] = elem.getNextBoolean();
				elem.remove(2);
			} else if(typeof thing  === "boolean") {
				(<any>resultObject)[key] = true;
				elem.remove(1);
			} else if(typeof thing  === "number") {
				(<any>resultObject)[key] = elem.getNextNumber();
				elem.remove(2);
			} else if(typeof thing  === "string") {
				(<any>resultObject)[key] = elem.getNextString();
				elem.remove(2);
			}
		}
	}
}

function printHelp<T extends Object>(options: T, nesting: string[]) {
	for(const key of Object.getOwnPropertyNames(options)) {
		let thing = (<any>options)[key];
		if(typeof thing === "object") {
			printHelp(thing, [...nesting, key]);
		} else {
			const sn = getShortName(options, key);
			console.log("\t" + `${sn != "" ? "-" + sn + " " : ""}--${[...nesting, key].join(".")}`
				+ ` ${buildDocString(options, key)}`);
		}
	}
}

function parseCMDargs<T extends Object>(options: T): T {
	fillUpConfig(options, []);
	return options;
}

/**
 * This functions parses the command line options described in the object
 * options.
 * All options must have must have a default value (no undefined).
 * Nested objects are handled by prefixing them with name + a dot.
 *
 * @param options The object defining the options available.
 * @param msg The message to passed to the Error if thrown
 * @returns the passed in options
 */
export function parseCMD<T extends Object>(options: T, header: string): T {
	if(process.argv.indexOf("--help") !== - 1
			|| process.argv.indexOf("-h") !== -1)
	{
		console.log(header);
		printHelp(options, []);
		process.exit(0);
	} else {
		return parseCMDargs(options);
	}
}
