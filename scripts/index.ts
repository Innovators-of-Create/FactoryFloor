import {readdir} from "node:fs/promises";
import {$} from "bun";

const pwd = (await $`pwd`.text()).trim()
if (!pwd.endsWith("/scripts")) {
    console.log("please run the script from inside the scripts dir (current: " + pwd + ")")
    process.exit()
}

class ModrinthProjectMeta {
    public projectType: ModrinthProjectType;
    public id: string;
    public title: string;
    public license: string;
    public url: string;
    public sourceUrl: string;

    constructor(project_type: ModrinthProjectType, id: string, title: string, license: string, url: string, source_url: string) {
        this.projectType = project_type;
        this.id = id;
        this.title = title;
        this.license = license;
        this.url = url;
        this.sourceUrl = source_url;
    }
}

enum ModrinthProjectType {
    MOD = "mod",
    RESOURCE_PACK = "resourcepack",
    SHADER_PACK = "shaderpack"
}

async function getMetaForProjects(projectType: ModrinthProjectType) {
    const mods: ModrinthProjectMeta[] = []

    const files = await readdir(`../${projectType}s/`)
    for (const projectFileName of files) {
        const projectFile = await Bun.file(`../${projectType}s/` + projectFileName).text()
        const projectId = Buffer.from(projectFile).toString().split("mod-id = \"")[1]?.split("\"")[0]

        const res = await fetch("https://api.modrinth.com/v2/project/" + projectId)
        const json: any = await res.json()

        mods.push(new ModrinthProjectMeta(projectType, json.id, json.title, json.license.id, "https://modrinth.com/project/" + json.id, json.source_url))
    }

    return mods
}

console.log("Getting metadata for mods")
const mods = await getMetaForProjects(ModrinthProjectType.MOD)
console.log("Getting metadata for resource packs")
const resourcePacks = await getMetaForProjects(ModrinthProjectType.RESOURCE_PACK)
console.log("Getting metadata for shader packs")
const shaderPacks = await getMetaForProjects(ModrinthProjectType.SHADER_PACK)

async function createProjectList(projects: ModrinthProjectMeta[], title: string, advanced: boolean = false) {
    let projectList = `<details><summary><strong>${title}</strong></summary><ul>`

    projects.forEach(project => {
        if (!advanced) {
            const link = `\n<li><a href=${project.url}>${project.title}</a></li>`
            projectList += link
        } else {
            const link = `\n<li><a href=${project.url}>${project.title}</a> - License: ${project.license} Source: ${project.sourceUrl}</li>`
            projectList += link
        }
    })

    projectList += "</ul></details>"

    return projectList
}

console.log("Creating README mod list")
const modListReadme = await createProjectList([...mods, ...resourcePacks, ...shaderPacks], "Mod List")
console.log("Creating full mod list")
const modListFull = await createProjectList([...mods, ...resourcePacks, ...shaderPacks], "Included Projects", true)

console.log("Updating MOD_LIST.md")
await Bun.write("../MOD_LIST.md", modListFull)

// Create/Update README

console.log("Updating README.md")
const readmeTemplate = await Bun.file("../assets/README-template.md").text()
const description = await Bun.file("../assets/DESCRIPTION.md").text()

const readmeOut = readmeTemplate.replace("$$$DESCRIPTION$$$", description).replace("$$$MODLIST$$$", modListReadme)
await Bun.write("../README.md", readmeOut)

// Export pack
console.log("Exporting pack")
await $`cd .. && packwiz modrinth export -o ./export/CreateFactoryFloor-Modrinth.mrpack`