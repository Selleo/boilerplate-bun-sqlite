import twPlugin from "bun-plugin-tailwind";

console.log("📦 Building server binary...");

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  compile: {
    outfile: "./dist/app",
  },
  plugins: [twPlugin],
  minify: true,
  sourcemap: true,
  // You can use the bytecode option if you use no top-level await
  // bytecode: true,
  // target: "bun", // local
  target: "bun-linux-x64", // server
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

console.log("✅ Build completed. Result:");
console.log("🔍", result);
