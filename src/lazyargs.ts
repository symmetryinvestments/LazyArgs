// @checkJs: true
const OptionMetaDataStore: string = "lazyArgs";

/**
 * The object that stores options about an command line option.
 */
export class LazyArg {
	/**
	 * The constructor of the LazyArg
	 * @param propName The property name of the option.
	 * @param shortName The short option name of the option
	 * @param doc Additional documentation of the option
	 */
	constructor(public propName: string, public shortName: string = "", public doc: string = "") {}
}

function getLazyArg(target: Object, propertyKey: string): LazyArg {
	let pro: Object = Object.getPrototypeOf(target);
	if(!pro.hasOwnProperty(OptionMetaDataStore)) {
		(pro as any)[OptionMetaDataStore] = {};
	}

	if(!(pro as any)[OptionMetaDataStore].hasOwnProperty(propertyKey)) {
		(pro as any)[OptionMetaDataStore][propertyKey] =
			new LazyArg(propertyKey);
	}

	return (pro as any)[OptionMetaDataStore][propertyKey];
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

function getShortName<T extends Object>(obj: T, propName: string): string {
	const lazyArg: LazyArg = getLazyArg(obj, propName);
	return lazyArg.shortName == ""
		? ""
		: "-" + lazyArg.shortName;
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

class Elem {
	public idx: number = -1;
	public name: string = "";
	constructor(public lName: string, public lIdx: number
		, public sName: string, public sIdx: number)
	{
		enforce(this.lIdx === -1 || this.sIdx === -1,
			`Found both '${this.lName}' at ${this.lIdx}`
			+ ` and '${this.sName}' at ${this.sIdx} in ${process.argv.join(", ")}`);

		const { i, n } =
			this.lIdx !== -1
				? {i: this.lIdx, n: this.lName}
				: this.sIdx !== -1
					? {i: this.sIdx, n: this.sName}
					: {i: -1, n: ""};

		this.idx = i;
		this.name = n;
	}

	isEmpty(): boolean {
		return this.idx == -1;
	}

	nextExist(): boolean {
		return this.idx + 1 < process.argv.length;
	}

	nextIsBoolean(): boolean {
		return this.nextExist()
			&& (process.argv[this.idx + 1] === "true"
				|| process.argv[this.idx + 1] === "false");
	}

	getNextBoolean(): boolean {
		return process.argv[this.idx + 1] === "true";
	}

	getNextNumber(): number {
		enforce(this.nextExist(), `To get a number from '${this.name}' at `
			+ `${this.idx} the next element must exist`);
		return parseInt(process.argv[this.idx + 1], 10);
	}

	getNextString(): string {
		enforce(this.nextExist(), `To get a string from '${this.name}' at `
			+ `${this.idx} the next element must exist`);
		return process.argv[this.idx + 1];
	}

	remove(howMany: 1 | 2) {
		process.argv.splice(this.idx, howMany);
	}
}

function fillUpConfig<T extends Object>(resultObject: T, nesting: string[]) {
	for(const key of Object.getOwnPropertyNames(resultObject)) {
		let thing = (<any>resultObject)[key];
		if(typeof thing === "object") {
			fillUpConfig(thing, [...nesting, key]);
		} else {
			const lName = `--${[...nesting, key].join(".")}`;
			const lIdx = process.argv.indexOf(lName);
			const sName = getShortName(resultObject, key);
			const sIdx = sName !== "" ? process.argv.indexOf(sName) : -1

			const elem = new Elem(lName, lIdx, sName, sIdx);
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
