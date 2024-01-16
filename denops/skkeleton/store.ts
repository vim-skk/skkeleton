import { Context } from "./context.ts";
import { Library } from "./dictionary.ts";
import { Cell, LazyCell } from "./util.ts";
import { Dictionary as UserDictionary } from "./sources/user_dictionary.ts";

export const currentContext = new Cell(() => new Context());
export const currentLibrary = new LazyCell(() =>
  new Library([], new UserDictionary())
);

export const variables = {
  lastMode: "hira",
};
