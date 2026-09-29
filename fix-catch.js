/* eslint-disable */
const fs = require("fs");
const path = require("path");

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      let content = fs.readFileSync(fullPath, "utf8");
      let changed = false;
      
      if (content.includes("catch () {")) {
        content = content.replace(/catch \(\) \{/g, "catch (error) {");
        changed = true;
      }
      if (content.includes(" instanceof Error ? .message : String()")) {
        content = content.replace(/ instanceof Error \? \.message : String\(\)/g, "error instanceof Error ? error.message : String(error)");
        changed = true;
      }
      
      // Also catch any remaining (error: any) or (err: any) and replace correctly
      const catchRegex = /catch\s*\(\s*(error|err|e)\s*:\s*any\s*\)\s*\{/g;
      if (catchRegex.test(content)) {
        content = content.replace(catchRegex, "catch ($1) {");
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log("Fixed " + fullPath);
      }
    }
  }
}

processDir(path.join(process.cwd(), "src"));
