/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createConfigItem } from "@babel/core";
import merge from "lodash.merge";
import rpBabel from "rollup-plugin-babel";

const ESMODULES_TARGET = {
	esmodules: true
};

function createConfigItems(type, items) {
	return items.map(({ name, ...options }) => {
		return createConfigItem([require.resolve(name), options], { type });
	});
}

function mergeConfigItems(type, ...configItemsToMerge) {
	const mergedItems = [];

	configItemsToMerge.forEach(configItemToMerge => {
		configItemToMerge.forEach(item => {
			const itemToMergeWithIndex = mergedItems.findIndex(
				mergedItem => mergedItem.file.resolved === item.file.resolved
			);

			if (itemToMergeWithIndex === -1) {
				mergedItems.push(item);
				return;
			}

			mergedItems[itemToMergeWithIndex] = createConfigItem(
				[
					mergedItems[itemToMergeWithIndex].file.resolved,
					merge(mergedItems[itemToMergeWithIndex].options, item.options)
				],
				{
					type
				}
			);
		});
	});

	return mergedItems;
}

export default rpBabel.custom(() => {
	return {
		// Passed the plugin options.
		options({ custom: customOptions, ...pluginOptions }) {
			return {
				// Pull out any custom options that the plugin might have.
				customOptions,

				// Pass the options back with the two custom options removed.
				pluginOptions
			};
		},
		config(config, { customOptions }) {
			const defaultPlugins = createConfigItems(
				"plugin",
				[
					customOptions.jsx && {
						name: "@babel/plugin-transform-react-jsx",
						pragma: customOptions.pragma || "h",
						pragmaFrag: customOptions.pragmaFrag || "Fragment"
					},
					!customOptions.modern && {
						name: "babel-plugin-transform-async-to-promises",
						inlineHelpers: true,
						externalHelpers: true
					},
					{
						name: "@babel/plugin-proposal-class-properties",
						loose: true
					},
					!customOptions.modern && {
						name: "@babel/plugin-transform-regenerator",
						async: false
					},
					{
						name: "babel-plugin-macros"
					}
				].filter(Boolean)
			);

			const babelOptions = config.options || {};

			const envIdx = (babelOptions.presets || []).findIndex(preset =>
				preset.file.request.includes("@babel/preset-env")
			);

			if (envIdx !== -1) {
				const preset = babelOptions.presets[envIdx];
				babelOptions.presets[envIdx] = createConfigItem(
					[
						preset.file.resolved,
						Object.assign(
							merge(
								{
									loose: true,
									useBuiltIns: false,
									targets: customOptions.targets
								},
								preset.options,
								{
									modules: false,
									exclude: merge(
										["transform-async-to-generator", "transform-regenerator"],
										preset.options.exclude || []
									)
								}
							),
							customOptions.modern ? { targets: ESMODULES_TARGET } : {}
						)
					],
					{
						type: `preset`
					}
				);
			} else {
				babelOptions.presets = createConfigItems("preset", [
					{
						name: "@babel/preset-env",
						targets: customOptions.modern ? ESMODULES_TARGET : customOptions.targets,
						modules: false,
						loose: !customOptions.modern,
						useBuiltIns: false,
						exclude: ["transform-async-to-generator", "transform-regenerator"]
					}
				]);
			}

			// Merge babelrc & our plugins together
			babelOptions.plugins = mergeConfigItems("plugin", defaultPlugins, babelOptions.plugins || []);

			babelOptions.generatorOpts = {
				minified: customOptions.compress,
				compact: customOptions.compress,
				shouldPrintComment: comment => /[@#]__PURE__/.test(comment)
			};

			return babelOptions;
		}
	};
});
