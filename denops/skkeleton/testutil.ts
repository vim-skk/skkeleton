import { fromFileUrl } from "./deps/std/path.ts";
import { autocmd, Denops } from "./deps.ts";
import { main } from "./main.ts";
import { currentContext } from "./store.ts";

export async function initDenops(denops: Denops): Promise<void> {
  const cfile = fromFileUrl(new URL(import.meta.url));
  const path = cfile.slice(0, cfile.lastIndexOf("denops"));
  await denops.cmd(`set runtimepath^=${path.replaceAll("\\", "/")}`);
  await denops.cmd("source " + path + "plugin/skkeleton.vim");
  await main(denops);
  await autocmd.emit(denops, "User", "DenopsPluginPost:skkeleton", {
    nomodeline: true,
  });
  currentContext.init().denops = denops;
}
