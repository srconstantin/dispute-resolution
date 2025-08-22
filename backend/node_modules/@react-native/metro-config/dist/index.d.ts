/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 * @format
 */

import type { ConfigT, InputConfigT } from "metro-config";
export type { MetroConfig } from "metro-config";
export { mergeConfig } from "metro-config";
export declare function setFrameworkDefaults(config: InputConfigT): void;
/**
 * Get the base Metro configuration for a React Native project.
 */
export declare function getDefaultConfig(projectRoot: string): ConfigT;
