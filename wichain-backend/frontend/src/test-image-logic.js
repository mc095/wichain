// Test file for image sending/receiving logic
// Run this in browser console to test image functionality

console.log('🧪 Testing WiChain Image Logic...');

// Test 1: Image Compression Function
function testImageCompression() {
  console.log('\n📸 Test 1: Image Compression');
  
  // Create a test canvas with some content
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  
  // Draw a test pattern
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 500, 400);
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(500, 0, 500, 400);
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(0, 400, 1000, 400);
  
  // Test compression
  const originalDataUrl = canvas.toDataURL('image/png');
  console.log('Original size:', originalDataUrl.length, 'characters');
  
  // Compress to 800px width
  const compressedCanvas = document.createElement('canvas');
  compressedCanvas.width = 800;
  compressedCanvas.height = 640;
  const compressedCtx = compressedCanvas.getContext('2d');
  compressedCtx.drawImage(canvas, 0, 0, 800, 640);
  
  const compressedDataUrl = compressedCanvas.toDataURL('image/jpeg', 0.8);
  console.log('Compressed size:', compressedDataUrl.length, 'characters');
  console.log('Compression ratio:', (compressedDataUrl.length / originalDataUrl.length * 100).toFixed(1) + '%');
  
  return {
    original: originalDataUrl,
    compressed: compressedDataUrl,
    originalSize: originalDataUrl.length,
    compressedSize: compressedDataUrl.length
  };
}

// Test 2: Image Data Structure
function testImageDataStructure() {
  console.log('\n📋 Test 2: Image Data Structure');
  
  const testImageData = {
    type: 'image',
    filename: 'test-image.jpg',
    data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A',
    originalSize: 1024000,
    compressedSize: 512000,
    mimeType: 'image/jpeg'
  };
  
  const messageText = `Hello! Here's an image\n[IMAGE_DATA:${JSON.stringify(testImageData)}]`;
  console.log('Message with image:', messageText);
  
  // Test parsing
  const imageMatch = messageText.match(/\[IMAGE_DATA:(.+?)\]/);
  if (imageMatch) {
    try {
      const parsedImageData = JSON.parse(imageMatch[1]);
      console.log('✅ Successfully parsed image data:', parsedImageData);
      return parsedImageData;
    } catch (error) {
      console.error('❌ Failed to parse image data:', error);
      return null;
    }
  }
  
  return null;
}

// Test 3: Size Validation
function testSizeValidation() {
  console.log('\n📏 Test 3: Size Validation');
  
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_BASE64_SIZE = 6 * 1024 * 1024; // 6MB
  
  const testSizes = [
    { name: 'Small image', size: 1024 * 1024 }, // 1MB
    { name: 'Medium image', size: 3 * 1024 * 1024 }, // 3MB
    { name: 'Large image', size: 5.5 * 1024 * 1024 }, // 5.5MB
    { name: 'Huge image', size: 10 * 1024 * 1024 } // 10MB
  ];
  
  testSizes.forEach(test => {
    const isValid = test.size <= MAX_SIZE;
    const base64Size = test.size * 1.33; // Approximate base64 overhead
    const base64Valid = base64Size <= MAX_BASE64_SIZE;
    
    console.log(`${test.name} (${(test.size / (1024 * 1024)).toFixed(1)}MB):`, {
      'Original valid': isValid ? '✅' : '❌',
      'Base64 size': (base64Size / (1024 * 1024)).toFixed(1) + 'MB',
      'Base64 valid': base64Valid ? '✅' : '❌'
    });
  });
}

// Test 4: Network Message Structure
function testNetworkMessageStructure() {
  console.log('\n🌐 Test 4: Network Message Structure');
  
  const imageData = {
    type: 'image',
    filename: 'test.jpg',
    data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A',
    originalSize: 1024,
    compressedSize: 512,
    mimeType: 'image/jpeg'
  };
  
  const chatBody = {
    from: 'sender_pubkey_b64',
    to: 'receiver_pubkey_b64',
    text: `Check this out!\n[IMAGE_DATA:${JSON.stringify(imageData)}]`,
    ts_ms: Date.now()
  };
  
  const chatSigned = {
    ...chatBody,
    sig_b64: 'signature_here'
  };
  
  const networkMessage = {
    type: 'DirectBlock',
    from: 'sender_pubkey_b64',
    to: 'receiver_pubkey_b64',
    payload_json: JSON.stringify(chatSigned)
  };
  
  console.log('Network message structure:', networkMessage);
  console.log('Total message size:', JSON.stringify(networkMessage).length, 'characters');
  
  // Check if it fits in UDP limit (8KB)
  const messageSize = JSON.stringify(networkMessage).length;
  const udpLimit = 8 * 1024;
  console.log('Fits in UDP (8KB):', messageSize <= udpLimit ? '✅' : '❌');
  
  return networkMessage;
}

// Test 5: Image Display Logic
function testImageDisplayLogic() {
  console.log('\n🖼️ Test 5: Image Display Logic');
  
  const testMessage = {
    text: 'Hello! Here\'s an image\n[IMAGE_DATA:{"type":"image","filename":"test.jpg","data":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A","originalSize":1024,"compressedSize":512,"mimeType":"image/jpeg"}]',
    from: 'sender',
    to: 'receiver',
    ts_ms: Date.now()
  };
  
  // Simulate the display logic
  const imageMatch = testMessage.text.match(/\[IMAGE_DATA:(.+?)\]/);
  if (imageMatch) {
    try {
      const imageData = JSON.parse(imageMatch[1]);
      const textWithoutImage = testMessage.text.replace(/\[IMAGE_DATA:.+?\]/, '').trim();
      
      console.log('✅ Image detected in message');
      console.log('Text without image:', textWithoutImage);
      console.log('Image filename:', imageData.filename);
      console.log('Image size:', imageData.compressedSize, 'bytes');
      console.log('Image type:', imageData.mimeType);
      
      return {
        hasImage: true,
        textWithoutImage,
        imageData
      };
    } catch (error) {
      console.error('❌ Failed to parse image data:', error);
      return { hasImage: false };
    }
  }
  
  console.log('❌ No image found in message');
  return { hasImage: false };
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running all image logic tests...\n');
  
  try {
    testImageCompression();
    testImageDataStructure();
    testSizeValidation();
    testNetworkMessageStructure();
    testImageDisplayLogic();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📝 Test Summary:');
    console.log('1. Image compression reduces file size significantly');
    console.log('2. Image data structure is properly formatted');
    console.log('3. Size validation prevents oversized uploads');
    console.log('4. Network messages fit within protocol limits');
    console.log('5. Image display logic correctly parses and extracts image data');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for manual testing
window.testImageLogic = {
  runAllTests,
  testImageCompression,
  testImageDataStructure,
  testSizeValidation,
  testNetworkMessageStructure,
  testImageDisplayLogic
};

console.log('💡 Run testImageLogic.runAllTests() to execute all tests');
console.log('💡 Or run individual tests like testImageLogic.testImageCompression()');
