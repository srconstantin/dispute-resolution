"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
exports.__esModule = true;
var PropTypes = require("prop-types");
var React = require("react");
var react_1 = require("react");
var react_native_1 = require("react-native");
var propTypes = __assign({}, react_native_1.Image.propTypes, { indicator: PropTypes.bool, indicatorColor: PropTypes.string, indicatorSize: PropTypes.oneOfType([
        PropTypes.oneOf(['small', 'large']),
        PropTypes.number,
    ]), originalHeight: PropTypes.number, originalWidth: PropTypes.number });
var styles = react_native_1.StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center'
    }
});
var FitImage = (function (_super) {
    __extends(FitImage, _super);
    function FitImage(props) {
        var _this = _super.call(this, props) || this;
        _this.ImageComponent = react_native_1.ImageBackground || react_native_1.Image;
        _this.mounted = false;
        _this.sizeStyle = {};
        _this.shouldDisplayIndicator = function () {
            return _this.state.isLoading && _this.props.indicator !== false;
        };
        _this.onLoad = function () {
            if (_this.state.isLoading) {
                _this.setState({ isLoading: false });
            }
            if (typeof _this.props.onLoad === 'function') {
                _this.props.onLoad();
            }
        };
        _this.onLoadStart = function () {
            if (_this.isFirstLoad) {
                _this.setState({ isLoading: true });
                _this.isFirstLoad = false;
            }
        };
        _this.onError = function () {
            if (_this.state.isLoading) {
                _this.setState({ isLoading: false });
            }
        };
        _this.getHeight = function () {
            if (_this.style && _this.style.height) {
                return Number(_this.style.height);
            }
            return Math.round(_this.getOriginalHeight() * _this.getRatio());
        };
        _this.getOriginalHeight = function () { return (_this.props.originalHeight || _this.state.originalHeight || 0); };
        _this.getOriginalWidth = function () { return (_this.props.originalWidth || _this.state.originalWidth || 0); };
        _this.getRatio = function () {
            if (_this.getOriginalWidth() === 0) {
                return 0;
            }
            return _this.state.layoutWidth / _this.getOriginalWidth();
        };
        _this.onLayout = function (event) {
            var layoutWidth = event.nativeEvent.layout.width;
            _this.setState({ layoutWidth: layoutWidth });
        };
        _this.fetchOriginalSizeFromRemoteImage = function () {
            var uri;
            if (_this.props.source instanceof Array) {
                uri = _this.props.source[0].uri;
            }
            else {
                uri = _this.props.source.uri;
            }
            if (!uri) {
                return;
            }
            react_native_1.Image.getSize(uri, function (originalWidth, originalHeight) {
                if (!_this.mounted) {
                    return;
                }
                _this.setOriginalSize(originalWidth, originalHeight);
            }, function () { return null; });
        };
        _this.setOriginalSize = function (originalWidth, originalHeight) {
            _this.setState({
                originalHeight: originalHeight,
                originalWidth: originalWidth
            });
        };
        _this.renderActivityIndicator = function () {
            return (React.createElement(react_native_1.ActivityIndicator, { color: _this.props.indicatorColor, size: _this.props.indicatorSize }));
        };
        _this.style = react_native_1.StyleSheet.flatten(props.style);
        if (_this.style) {
            var size = [_this.style.width, _this.style.height];
            if (size.filter(Boolean).length === 1) {
                throw new Error('Props error: size props must be present ' +
                    'none or both of width and height.');
            }
            if (_this.style.width) {
                _this.sizeStyle = { width: _this.style.width };
            }
            else {
                _this.sizeStyle = { flexGrow: 1 };
            }
        }
        var originalSize = [props.originalWidth, props.originalHeight];
        if (originalSize.filter(Boolean).length === 1) {
            throw new Error('Props error: originalSize props must be present ' +
                'none or both of originalWidth and originalHeight.');
        }
        _this.isFirstLoad = true;
        _this.state = {
            isLoading: false,
            layoutWidth: 0,
            originalHeight: 0,
            originalWidth: 0
        };
        return _this;
    }
    FitImage.prototype.componentDidMount = function () {
        this.mounted = true;
        if (this.props.originalWidth && this.props.originalHeight) {
            return;
        }
        this.fetchOriginalSizeFromRemoteImage();
    };
    FitImage.prototype.componentWillUnmount = function () {
        this.mounted = false;
    };
    FitImage.prototype.render = function () {
        var ImageComponent = this.ImageComponent;
        return (React.createElement(ImageComponent, __assign({}, this.props, { onLayout: this.onLayout, onLoad: this.onLoad, onLoadStart: this.onLoadStart, onError: this.onError, source: this.props.source, style: [
                this.style,
                this.sizeStyle,
                { height: this.getHeight() },
                styles.container,
            ] }), this.shouldDisplayIndicator() ? this.renderActivityIndicator() : this.props.children));
    };
    FitImage.propTypes = propTypes;
    return FitImage;
}(react_1.Component));
exports["default"] = FitImage;
