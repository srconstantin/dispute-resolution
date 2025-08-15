/// <reference types="react" />
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Component, ReactElement } from 'react';
import { ImageProperties } from 'react-native';
export interface IFitImageProps extends ImageProperties {
    children?: ReactElement<any>;
    /**
     * Whether should display activity indicator or not
     */
    indicator?: boolean;
    /**
     * Color of activity indicator in string
     */
    indicatorColor?: string;
    /**
     * Size of activity indicator
     */
    indicatorSize?: 'small' | 'large' | number;
    /**
     * Original height of the image
     *
     * @description
     * If you already know the height of the image you can pass it here.
     * Then it will be used instead of fetching the size information remotely.
     */
    originalHeight?: number;
    /**
     * Original width of the image
     *
     * @description
     * If you already know the width of the image you can pass it here.
     * Then it will be used instead of fetching the size information remotely.
     */
    originalWidth?: number;
}
export interface IFitImageState {
    isLoading: boolean;
    layoutWidth: number;
    originalHeight: number;
    originalWidth: number;
}
declare class FitImage extends Component<IFitImageProps, IFitImageState> {
    static propTypes: {
        indicator: PropTypes.Requireable<any>;
        indicatorColor: PropTypes.Requireable<any>;
        indicatorSize: PropTypes.Requireable<any>;
        originalHeight: PropTypes.Requireable<any>;
        originalWidth: PropTypes.Requireable<any>;
    } | {
        indicator: PropTypes.Requireable<any>;
        indicatorColor: PropTypes.Requireable<any>;
        indicatorSize: PropTypes.Requireable<any>;
        originalHeight: PropTypes.Requireable<any>;
        originalWidth: PropTypes.Requireable<any>;
        onLayout?: React.Validator<ImageProperties> | undefined;
        onError?: React.Validator<ImageProperties> | undefined;
        onLoad?: React.Validator<ImageProperties> | undefined;
        onLoadEnd?: React.Validator<ImageProperties> | undefined;
        onLoadStart?: React.Validator<ImageProperties> | undefined;
        progressiveRenderingEnabled?: React.Validator<ImageProperties> | undefined;
        resizeMode?: React.Validator<ImageProperties> | undefined;
        resizeMethod?: React.Validator<ImageProperties> | undefined;
        source?: React.Validator<ImageProperties> | undefined;
        loadingIndicatorSource?: React.Validator<ImageProperties> | undefined;
        style?: React.Validator<ImageProperties> | undefined;
        testID?: React.Validator<ImageProperties> | undefined;
        accessibilityLabel?: React.Validator<ImageProperties> | undefined;
        accessible?: React.Validator<ImageProperties> | undefined;
        blurRadius?: React.Validator<ImageProperties> | undefined;
        capInsets?: React.Validator<ImageProperties> | undefined;
        defaultSource?: React.Validator<ImageProperties> | undefined;
        onProgress?: React.Validator<ImageProperties> | undefined;
        onPartialLoad?: React.Validator<ImageProperties> | undefined;
    };
    private ImageComponent;
    private isFirstLoad;
    private mounted;
    private sizeStyle;
    private style;
    constructor(props: IFitImageProps);
    componentDidMount(): void;
    componentWillUnmount(): void;
    render(): JSX.Element;
    private shouldDisplayIndicator;
    private onLoad;
    private onLoadStart;
    private onError;
    private getHeight;
    private getOriginalHeight;
    private getOriginalWidth;
    private getRatio;
    private onLayout;
    private fetchOriginalSizeFromRemoteImage;
    private setOriginalSize;
    private renderActivityIndicator;
}
export default FitImage;
