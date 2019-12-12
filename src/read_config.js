const fs = require("fs");
const path = require("path");

module.exports = function read_config(config) {
  if (config) {
    try {
      return {
        ...require("../default-config.json"),
        ...JSON.parse(fs.readFileSync(config))
      };
    } catch (err) {
      console.error("Invalid config file: " + config + " is either missing or invalid.");
      console.error(err);
      process.exit(3);
    }
  } else {
    let homedir = require("os").homedir();
    if (fs.readdirSync(homedir).includes(".config")) {
      if (fs.readdirSync(path.join(homedir, ".config")).includes("patpat")) {
        try {
          return {
            ...require("../default-config.json"),
            ...JSON.parse(fs.readFileSync(path.join(homedir, ".config/patpat/config.json")))
          };
        } catch (err) {
          console.error("~/.config/patpat/ was found, but ~/.config/patpat/config.json is either missing or invalid.");
          console.error(err);
          process.exit(3);
        }
      } else {
        fs.mkdirSync(path.join(homedir, ".config/patpat"));
        return require("../default-config.json");
        fs.writeFileSync(path.join(homedir, ".config/patpat/config.json"), JSON.stringify(config, " ", 2));
      }
    }
  }
}
