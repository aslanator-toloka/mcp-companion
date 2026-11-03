package org.mcpcompanion.local;
import static org.junit.Assert.*;
import org.junit.Test;
public class PhotoInputPolicyTest {
    @Test public void largePhonePhotoIsDecodedWithBoundedMemory() {
        assertEquals(1, PhotoInputPolicy.sampleSize(1800, 1200));
        assertEquals(2, PhotoInputPolicy.sampleSize(4032, 3024));
        assertEquals(4, PhotoInputPolicy.sampleSize(8064, 6048));
        assertEquals(2, PhotoInputPolicy.sampleSize(3201, 2000));
        assertEquals(4, PhotoInputPolicy.sampleSize(2000, 8000));
    }
    @Test public void rotationsNormalizeBothDirections() {
        assertEquals(270, PhotoInputPolicy.rotation(-90));
        assertEquals(0, PhotoInputPolicy.rotation(360));
        assertEquals(90, PhotoInputPolicy.rotation(450));
    }
    @Test(expected = IllegalArgumentException.class) public void rejectsNonRightAngle() { PhotoInputPolicy.rotation(15); }
    @Test(expected = IllegalArgumentException.class) public void rejectsInvalidDimensions() { PhotoInputPolicy.sampleSize(-1, 100); }
    @Test(expected = IllegalArgumentException.class) public void rejectsDecompressionBomb() { PhotoInputPolicy.sampleSize(90000, 90000); }
    @Test public void idsCannotBeFilePaths() {
        assertTrue(PhotoInputPolicy.validId("5f9bf522-5911-4ddf-8b1e-338fe5f26dd5"));
        assertFalse(PhotoInputPolicy.validId("../../files/private.json"));
        assertFalse(PhotoInputPolicy.validId("file:///data/photos/image.jpg"));
        assertFalse(PhotoInputPolicy.validId(null));
    }
}
