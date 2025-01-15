import { App, PluginSettingTab, Setting, Notice} from 'obsidian';
import TikzjaxPlugin from "./main";
import * as localForage from "localforage";


export interface TikzjaxPluginSettings {
	invertColorsInDarkMode: boolean;
	enableCustomPackages: boolean;
	customPackages: string[];
}

export const DEFAULT_SETTINGS: TikzjaxPluginSettings = {
	invertColorsInDarkMode: true,
	enableCustomPackages: false,
	customPackages: []
}


export class TikzjaxSettingTab extends PluginSettingTab {
	plugin: TikzjaxPlugin;

	constructor(app: App, plugin: TikzjaxPlugin) {
		super(app, plugin);
		this.plugin = plugin;


		// Configure localForage if it hasn't been configured by TikZJax already
		// The try-catch block fixes the plugin failing to load on mobile
		try {
			localForage.config({ name: 'TikzJax', storeName: 'svgImages' });
		} catch (error) {
			console.log(error);
		}
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Invert dark colors in dark mode')
			.setDesc('Invert dark colors in diagrams (e.g. axes, arrows) when in dark mode, so that they are visible.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.invertColorsInDarkMode)
				.onChange(async (value) => {
					this.plugin.settings.invertColorsInDarkMode = value;

					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('Clear cached SVGs')
			.setDesc('SVGs rendered with TikZJax are stored in a database, so diagrams don\'t have to be re-rendered from scratch every time you open a page. Use this to clear the cache and force all diagrams to be re-rendered.')
			.addButton(button => button
				.setIcon("trash")
				.setTooltip("Clear cached SVGs")
				.onClick(async () => {
					localForage.clear((err) => {
						if (err) {
							console.log(err);
							new Notice(err, 3000);
						}
						else {
							new Notice("TikZJax: Successfully cleared cached SVGs.", 3000);
						}
					});
				}));
		

		new Setting(containerEl)
			.setName('Enable custom packages')
			.setDesc('Enable this option to install custom LaTeX packages. Enter package names separated by spaces (e.g. pgfplots amsmath fontspec).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCustomPackages)
				.onChange(async (value) => {
					if (!value && this.plugin.settings.customPackages) {
						const success = await this.plugin.uninstallPackages(this.plugin.settings.customPackages.join(" "));
						if (!success) {
							new Error("Failed to uninstall custom packages. Check console for details.");
							toggle.setValue(true);
							return;
						}
					}

					this.plugin.settings.enableCustomPackages = value;
					await this.plugin.saveSettings();
				}));

				
		let tempText: string = "";

		new Setting(containerEl)
			.addText(text => text
				.setDisabled(this.plugin.settings.enableCustomPackages)
				.setValue(this.plugin.settings.customPackages.join(" "))
				.onChange(async (value) => {
					tempText = value;
				}))
			.addButton(button => button
				.setDisabled(this.plugin.settings.enableCustomPackages)
				.setIcon("save")
				.setTooltip("Update packages")
				.onClick(async () => {
					button.setDisabled(true);
					button.setIcon("sync");
					
					//Checks for invalid characters in text field.
					const invalidCharacters = tempText.replace(/[a-z0-9\s]/g, "");
					if (invalidCharacters.length > 0) {
						new Notice(`Invalid characters found in package names. Ensure that your packages are separated by spaces and typed properly.`);
						return;
					}
					
					// Gets the difference between the packages on file and the user-typed packages. 
					const newPackages = tempText.split(" ").filter(pkg => pkg.trim() !== "");
					const packagesToUninstall = this.plugin.settings.customPackages.filter(pkg => !newPackages.includes(pkg));

					// Uninstalls any packages not in new user-typed text box. 
					let uninstSuccess: boolean = true;
					if (packagesToUninstall.length > 0) {
						uninstSuccess = await this.plugin.uninstallPackages(packagesToUninstall.join(" "));
					}

					// Installs any packages not in existing packages list.
					const instSuccess = await this.plugin.installPackages(newPackages.join(" "));
					if (!instSuccess || !uninstSuccess) {
						new Error("Failed to update some packages. Check console for details, or refresh page to see currently installed packages and retry.");
					} else {
						new Notice("Packages updated successfully!");
					}
					
					this.plugin.settings.customPackages = await this.plugin.getPackages();
					await this.plugin.saveSettings();
					button.setDisabled(false);
					button.setIcon("save");
				}));
	}
}
