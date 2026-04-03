import "@supabase/functions-js/edge-runtime.d.ts";
import { createFruitHandler } from "../_shared/handleIncomingFruit.ts";

Deno.serve(createFruitHandler("apple"));
