import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Colors } from '../constants/Colors';

interface SignatureCanvasProps {
  onSave: (signature: string) => void;
  onCancel: () => void;
}

const { width } = Dimensions.get('window');

export default function SignatureCanvas({ onSave, onCancel }: SignatureCanvasProps) {
  const [paths, setPaths] = useState<Array<{ x: number; y: number }[]>>([]);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setIsDrawing(true);
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        if (isDrawing) {
          const { locationX, locationY } = evt.nativeEvent;
          setCurrentPath(prev => [...prev, { x: locationX, y: locationY }]);
        }
      },
      onPanResponderRelease: () => {
        setIsDrawing(false);
        setPaths(prev => [...prev, currentPath]);
        setCurrentPath([]);
      },
    })
  ).current;

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  const saveSignature = () => {
    if (paths.length > 0) {
      // Convert paths to a simple string representation
      const signatureData = JSON.stringify(paths);
      onSave(signatureData);
    } else {
      onSave('Digital Signature');
    }
  };

  const renderPath = (path: Array<{ x: number; y: number }>, index: number) => {
    if (path.length < 2) return null;

    const pathString = path
      .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    return (
      <View
        key={index}
        style={[
          styles.path,
          {
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.canvasContainer}>
        <View
          style={styles.canvas}
          {...panResponder.panHandlers}
        >
          {paths.map((path, index) => renderPath(path, index))}
          {currentPath.length > 0 && renderPath(currentPath, -1)}
          
          {paths.length === 0 && (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>
                Draw your signature here
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.clearButton} onPress={clearCanvas}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={saveSignature}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  canvasContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  path: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  controls: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  clearButton: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 16,
  },
  clearButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
});
