import { Context } from "./context.ts";
import { Library } from "./jisyo.ts";
import { Cell, LazyCell } from "./util.ts";

export const currentContext = new Cell(() => new Context());
export const currentLibrary = new LazyCell(() => new Library());
