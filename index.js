import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  PermissionsAndroid,
  Alert
} from 'react-native';
import CameraRoll from "@react-native-community/cameraroll";
import PropTypes from 'prop-types';
import Row from './Row';

import ImageItem from './ImageItem';

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
  },
  loader: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// helper functions
const arrayObjectIndexOf = (array, property, value) => array.map(o => o[property]).indexOf(value);

const nEveryRow = (data, n) => {
  const result = [];
  let temp = [];

  for (let i = 0; i < data.length; ++i) {
    if (i > 0 && i % n === 0) {
      result.push(temp);
      temp = [];
    }
    temp.push(data[i]);
  }

  if (temp.length > 0) {
    while (temp.length !== n) {
      temp.push(null);
    }
    result.push(temp);
  }

  return result;
};

class CameraRollPicker extends Component {
  constructor(props) {
    super(props);

    this.state = {
      images: [],
      selectedImages: this.props.selected,
      selected: [],
      lastCursor: null,
      initialLoading: true,
      loadingMore: false,
      noMore: false,
      data: [],
    };

    this.renderFooterSpinner = this.renderFooterSpinner.bind(this);
    this.onEndReached = this.onEndReached.bind(this);
    this.renderRow = this.renderRow.bind(this);
    this.selectImage = this.selectImage.bind(this);
    this.renderImage = this.renderImage.bind(this);
  }

  static _getAlbums = () => {
    return CameraRoll.getPhotos({
        first: 10000,
        assetType: 'Photos'
    })
        .then(ress => {
            return [...new Set(ress.edges.map(a => a.node.group_name))]
        })
        .catch(err => {
            return err
        })
  }

  _requestPermission = () => {
    PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    )
        .then(granted => {
            if (granted) {
                this.fetch(undefined)
            } else {
                Alert.alert(
                    'Permissão não concedida',
                    'Sem a permissão de acesso ao armazenamento você não vai conseguir selecionar as fotos!'
                )
            }
        })
        .catch(err => {
            Alert.alert(
                'Permissão não concedida',
                'Sem a permissão de acesso ao armazenamento você não vai conseguir selecionar as fotos!'
            )
        })
  }

  componentWillMount() {
    if (Platform.OS == 'ios') {
      this.fetch(undefined)
    } else {
        PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        ).then(granted => {
            if (granted) {
                this.fetch(undefined)
            } else {
                this._requestPermission()
            }
        })
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.groupName !== this.props.groupName)
        this.fetch(true)
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      selected: nextProps.selected,
    });
  }

  onEndReached() {
    if (!this.state.noMore) {
      this.fetch(undefined);
    }
  }

  appendImages(data, updated) {
    const assets = data.edges;
    let newState = {
      loadingMore: false,
      initialLoading: false,
    };

    newState.noMore = !data.page_info.has_next_page
    if (updated) {
        newState.selected = []
        newState.selectedImages = this.props.selected
        newState.images = [...assets]
    } else {
        newState.images = this.state.images.concat(assets)
    }

    if (assets.length > 0) {
      newState.lastCursor = data.page_info.end_cursor;
      // newState.data = nEveryRow(newState.images, this.props.imagesPerRow);
    }

    this.setState(newState);
  }

  fetch(updated) {
    if (!this.state.loadingMore || updated) {
      this.setState({ loadingMore: true }, () => { this.doFetch(updated); });
    }
  }

  doFetch(updated) {
    const { groupTypes, groupName, requestAlbums, assetType } = this.props;

    const fetchParams = {
      first: 1000,
      groupTypes,
      groupName,
      assetType,
    };

    if (Platform.OS === 'android') {
      // not supported in android
      delete fetchParams.groupTypes;
    }

    if (!groupName) delete fetchParams.groupName

    if (this.state.lastCursor) {
      fetchParams.after = this.state.lastCursor;
    }

    CameraRoll.getPhotos(fetchParams)
      .then(data => {
          if (this.state.images.length === 0 && !updated)
              requestAlbums()
          this.appendImages(data, updated)
        }, e => console.log(e));
  }

  selectImage(image, index) {
    const {
      maximum, callback, selectSingleItem, callbackMaximum
    } = this.props;

    let { selected, selectedImages, images } = this.state
    let indexInSelected = selected.indexOf(index)

    if (indexInSelected >= 0) {
        selected.splice(indexInSelected, 1)

        // remove from selected images
        var indexInSelectedImages = selectedImages
            .map(img => img.uri)
            .indexOf(images[index].node.image.uri)
        selectedImages.splice(indexInSelectedImages, 1)
    } else {
        if (selectSingleItem) {
            selected = [index]
            selectedImages = [image]
        } else {
            if (selected.length < maximum) {
                selected.push(index)
                selectedImages.push(image)
            } else {
                // maximum
                if (callbackMaximum) callbackMaximum()
            }
        }
    }

    this.setState({
      selected: selected,
      selectedImages: selectedImages,
      // data: nEveryRow(this.state.images, imagesPerRow),
    });

    callback(selected, image);
  }

  renderImage(item, index) {
    const { selected } = this.state;
    const {
      imageMargin,
      selectedMarker,
      imagesPerRow,
      containerWidth,
      ratio
    } = this.props;

    const { uri } = item.node.image;
    const isSelected = selected.indexOf(index) >= 0;

    return (
      <ImageItem
        key={uri}
        item={item}
        index={index}
        selected={isSelected}
        imageMargin={imageMargin}
        selectedMarker={selectedMarker}
        imagesPerRow={imagesPerRow}
        containerWidth={containerWidth}
        onClick={image => this.selectImage.bind(this)(image, index)}
        ratio={ratio}
      />
    );
  }

  renderRow(item, index) { // item is an array of objects
    const isSelected = item.map((imageItem) => {
      let imgIndex
      if (!imageItem) return false;
      const { uri } = imageItem.node.image;
      imgIndex = this.props.imagesPerRow * index + arrayObjectIndexOf(this.state.selected, 'uri', uri)
      return arrayObjectIndexOf(this.state.selected, 'uri', uri) >= 0;
    });
    return (<Row
      rowData={item}
      isSelected={isSelected}
      selectImage={image => this.selectImage.bind(this)(image, index)}
      imagesPerRow={this.props.imagesPerRow}
      containerWidth={this.props.containerWidth}
      imageMargin={this.props.imageMargin}
      selectedMarker={this.props.selectedMarker}
      ratio={this.props.ratio}
    />);
  }

  renderFooterSpinner() {
    if (!this.state.noMore) {
      return <ActivityIndicator style={styles.spinner} />;
    }
    return null;
  }

  render() {
    const {
      initialNumToRender,
      imageMargin,
      backgroundColor,
      emptyText,
      emptyTextStyle,
      loader,
      listHeader,
      listEmpty,
      removeClippedSubviews,
      pageSize
    } = this.props;

    if (this.state.initialLoading) {
      return (
        <View style={[styles.loader, { backgroundColor }]}>
          { loader || <ActivityIndicator /> }
        </View>
      );
    }

    const { images } = this.state

    const flatListOrEmptyText = images.length > 0 ? (
      <FlatList
        style={{ flex: 1 }}
        numColumns={pageSize}
        initialNumToRender={initialNumToRender}
        data={images}
        removeClippedSubviews={removeClippedSubviews}
        keyExtractor={(item, index) => `rncrp_item_${index}`}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={this.renderFooterSpinner.bind(this)}
        onEndReached={this.onEndReached.bind(this)}
        renderItem={({ item, index }) => this.renderImage(item, index)}
        // keyExtractor={item => item[0].node.image.uri}
        // data={this.state.data}
        // extraData={this.state.selected}
      />
    ) : (
      <Text style={[{ textAlign: 'center' }, emptyTextStyle]}>{emptyText}</Text>
    );

    return (
      <View
        style={[styles.wrapper, { paddingRight: 0, backgroundColor }]}
      >
        {flatListOrEmptyText}
      </View>
    );
  }
}

CameraRollPicker.propTypes = {
  initialNumToRender: PropTypes.number,
  // initialListSize: PropTypes.number,
  pageSize: PropTypes.number,
  removeClippedSubviews: PropTypes.bool,
  groupTypes: PropTypes.oneOf([
    'Album',
    'All',
    'Event',
    'Faces',
    'Library',
    'PhotoStream',
    'SavedPhotos',
  ]),
  groupName: PropTypes.string,
  requestAlbums: PropTypes.func,
  maximum: PropTypes.number,
  assetType: PropTypes.oneOf([
    'Photos',
    'Videos',
    'All',
  ]),
  selectSingleItem: PropTypes.bool,
  imagesPerRow: PropTypes.number,
  imageMargin: PropTypes.number,
  containerWidth: PropTypes.number,
  callback: PropTypes.func,
  selected: PropTypes.array,
  selectedMarker: PropTypes.element,
  backgroundColor: PropTypes.string,
  emptyText: PropTypes.string,
  emptyTextStyle: Text.propTypes.style,
  loader: PropTypes.node,
  callbackMaximum: PropTypes.func,
  listEmpty: PropTypes.func || PropTypes.element || PropTypes.node,
  listHeader: PropTypes.func || PropTypes.element || PropTypes.node
};

CameraRollPicker.defaultProps = {
  initialNumToRender: 5,
  pageSize: 3,
  removeClippedSubviews: true,
  groupTypes: 'SavedPhotos',
  maximum: 15,
  imagesPerRow: 3,
  imageMargin: 5,
  selectSingleItem: false,
  assetType: 'Photos',
  backgroundColor: 'white',
  selected: [],
  callback(selectedImages, currentImage) {
    console.log(currentImage);
    console.log(selectedImages);
  },
  emptyText: 'No photos.',
  ratio: 1,
  callbackMaximum: function () {
      console.log('You have already selected all the photos allowed')
  }
};

export default CameraRollPicker;
