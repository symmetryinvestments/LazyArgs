# LazyArgs

A typescript command line argument parser that does the work for you

```ts
class YourNestedOptions {
	arg: string = "Hello nested";
}

class YourCLIOptions {
	foo: number = 10;

	OptionDoc("Some good documentation")
	bar: string = Hello World;

	OptionShort('n')
	nested: YourNestedOptions = new YourNestedOptions();
}

let options = new YourCLIOptions();
return parseCMD(options, "Header for the help string");

// options are passed in as --foo 1234 or --bar "A string"'
// for nested options your prefix the passed args as --nested.arg "Foo"
```

If -h or --help is passed the help information will be printed and
process.exit(0) is called.

This package requires:

```json
{
	"compilerOptions": {
		"experimentalDecorators": true
	}
}
```

to be passed to the typescript compiler.
