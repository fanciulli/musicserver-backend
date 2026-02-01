/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Plugin } from "../types/plugins/plugin";
const { readdir, Dirent } = require('node:fs/promises');
import path from 'node:path';

const listFolders = async (parentFolder: string): Promise<string[]> => {
    const dirListing = await readdir(parentFolder, { withFileTypes: true });
    const directories = dirListing.filter(item => { return item.isDirectory() })
        .map(dir => { return dir.name });
    return directories;
}

class PluginList {
    category: string;
    #plugins: Map<string, Plugin> = new Map();

    constructor(category: string) {
        this.category = category;
    }


    get(name: string): Plugin | undefined {
        return this.#plugins.get(name);
    }

    async loadPluginsFromFolder(folderPath: string): Promise<void> {
        const pluginsDirectories = await listFolders(folderPath);

        for (let pluginDir of pluginsDirectories) {
            const pluginIndexFile = path.join(folderPath, pluginDir, 'index.js');
            const pluginModule = await import(pluginIndexFile);
            const pluginClass = pluginModule.default.default;
            const pluginInstance: Plugin = new pluginClass();
            this.#plugins.set(pluginInstance.id, pluginInstance);

            console.log(`Loaded plugin ${pluginInstance.id} in category ${this.category}`);
        }
    }

    async startPlugins(): Promise<void> {
        for (let plugin of this.#plugins.values()) {
            await plugin.start();
        }
    }
}

export class PluginManager {
    #pluginsFolder: string = '.';
    #plugins: Map<string, PluginList> = new Map();

    constructor(pluginsFolder: string) {
        this.#pluginsFolder = pluginsFolder;
    }

    async loadPlugins(): Promise<void> {
        const categories = await listFolders(this.#pluginsFolder);

        for (let category of categories) {
            console.log('loading category ' + category);
            let pluginList = new PluginList(category);
            await pluginList.loadPluginsFromFolder(path.join(this.#pluginsFolder, category));

            this.#plugins.set(category, pluginList);
        }
    };

    async startPlugins(): Promise<void> {
        console.log('Starting plugins...');
        for (let pluginList of this.#plugins.values()) {
            await pluginList.startPlugins();
        }
    };

    getPluginsInCategory(category: string): PluginList | undefined {
        return this.#plugins.get(category);
    }

    getPlugin = (category: string, name: string): Plugin | undefined => {
        return this.getPluginsInCategory(category)?.get(name);
    };
}