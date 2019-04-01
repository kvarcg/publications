#line 2 
// Generic utilities

// Cubemap UV to XYZ conversion
// Parameters:
// - face_index, the cubemap face index
// - tex_coords, the uv texture coordinates in the range [0, 1)
// Returns the XYZ representation for sampling the cubemap
// Source: https://en.wikipedia.org/wiki/Cube_mapping
vec3 convert_cube_uv_to_xyz(int face_index, vec2 tex_coords)
{
	vec3 cubemap_xyz;
	// convert range 0 to 1 to -1 to 1
	float uc = 2.0f * tex_coords.x - 1.0f;
	float vc = 2.0f * tex_coords.y - 1.0f;
	if (face_index == 0) { cubemap_xyz.x = 1.0f; cubemap_xyz.y = vc; cubemap_xyz.z = -uc; } // POSITIVE X
	else if (face_index == 1) { cubemap_xyz.x = -1.0f; cubemap_xyz.y = vc; cubemap_xyz.z = uc; } // NEGATIVE X
	else if (face_index == 2) { cubemap_xyz.x = uc; cubemap_xyz.y = 1.0f; cubemap_xyz.z = -vc; } // POSITIVE Y
	else if (face_index == 3) { cubemap_xyz.x = uc; cubemap_xyz.y = -1.0f; cubemap_xyz.z = vc; } // NEGATIVE Y
	else if (face_index == 4) { cubemap_xyz.x = uc; cubemap_xyz.y = vc; cubemap_xyz.z = 1.0f; } // POSITIVE Z
	else if (face_index == 5) { cubemap_xyz.x = -uc; cubemap_xyz.y = vc; cubemap_xyz.z = -1.0f; } // NEGATIVE Z
	return cubemap_xyz;
}

// Color Utilities

// HSV to RGB conversion
// Parameters:
// - c, the HSV value, where values are in the range [0,1]
// Returns the RGB value
// Source: http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 hsv2rgb_normalized(vec3 c)
{
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// HSV to RGB conversion
// Parameters:
// - c, the HSV value, where H is in the range [0, 360] and SV values are in the range [0,1]
// Returns the RGB value
vec3 hsv2rgb(vec3 c)
{
	c.x /= 360.0;
	return hsv2rgb_normalized(c);
}

// RGB to HSV conversion
// Parameters:
// - c, the RGB value
// Returns the HSV value in the range [0,1]
// Source: http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 rgb2hsv_normalized(vec3 c)
{
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy);
	vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx);

	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// RGB to HSV conversion
// Parameters:
// - c, the RGB value
// Returns the HSV value, where H is in the range [0, 360] and SV values are in the range [0,1]
vec3 rgb2hsv(vec3 c)
{
	vec3 rgb = rgb2hsv_normalized(c);
	return vec3(rgb.x * 360.0, rgb.yz);
}

// Returns the luminance of an RGB value
// Parameters:
// - color, the RGB value
// returns the luminance
float luminance(vec3 color)
{
	return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

// Creates a linear heatmap based on a value and a range
// Parameters:
// - value, the normalized value
// - minv, the minimum value
// - maxv, the maximum value
// returns a heatmap color for the requested value
vec3 makeHeatMapLinear(float value, float minv, float maxv)
{
	// set color thresholds
	vec3	heatmap_hsl = vec3(0.0, 1.0, 1.0);
	float range = abs(maxv - minv);
	float norm = (value - minv) / range;
	heatmap_hsl.r = mix(240, 0, norm);

	return hsv2rgb(heatmap_hsl);
}

// Creates a linear heatmap based on a value and a range
// where 0 is displayed as black
// Parameters:
// - value, the normalized value
// - minv, the minimum value
// - maxv, the maximum value
// returns a heatmap color for the requested value
vec3 makeHeatMapLinearZeroBlack(float value, float minv, float maxv)
{
	// set color thresholds
	vec3	heatmap_hsl = vec3(0.0, 1.0, 1.0);
	if (value < 0.001)
	{
		heatmap_hsl.b = 0;
	}
	float range = abs(maxv - minv);
	float norm = (value - minv) / range;
	heatmap_hsl.r = mix(240, 0, norm);

	return hsv2rgb(heatmap_hsl);
}

// Creates a linear heatmap based on a value and a range
// where 0 is displayed as white
// Parameters:
// - value, the normalized value
// - minv, the minimum value
// - maxv, the maximum value
// returns a heatmap color for the requested value
vec3 makeHeatMapLinearZeroWhite(float value, float minv, float maxv)
{
	// set color thresholds
	vec3	heatmap_hsl = vec3(0.0, 1.0, 1.0);
	if (value < 0.001)
	{
		heatmap_hsl.b = 1;
		heatmap_hsl.g = 0;
	}
	float range = abs(maxv - minv);
	float norm = (value - minv) / range;
	heatmap_hsl.r = mix(240, 0, norm);

	return hsv2rgb(heatmap_hsl);
}

// Creates a heatmap based on a normalized value and 2 midpoints
// where 0 is displayed as black
// Parameters:
// - value, the normalized value
// - thres1, the first midpoint
// - thres2, the second midpoint
// returns a heatmap color for the requested value
vec3 makeHeatMapZeroBlack(float value, float thres1, float thres2)
{
	// set color thresholds
	// value at 0 is black
	// value from 0 - thres1 is blue
	// value from thres1 to midpoint1 is blue to cyan
	// value from midpoint1 to midpoint2 is cyan to green
	// value from midpoint2 to thres2 is green to yellow
	// value above thres2 is yellow to red
	vec3	heatmap_hsl = vec3(0.0, 1.0, 1.0);
	float midpoint1 = thres1 + (thres2 - thres1) / 3.0;
	float midpoint2 = thres1 + 2 * (thres2 - thres1) / 3.0;
	if (value < 0.001)
	{
		heatmap_hsl.b = 0;
	}
	else if (value < thres1)
	{
		heatmap_hsl.r = 240.0;
	}
	else if (value >= thres1 && value < midpoint1)
	{
		heatmap_hsl.r = mix(240, 180, (value - thres1) / (midpoint1 - thres1));
	}
	else if (value >= midpoint1 && value < midpoint2)
	{
		heatmap_hsl.r = mix(180, 120, (value - midpoint1) / (midpoint2 - midpoint1));
	}
	else if (value >= midpoint2 && value < thres2)
	{
		heatmap_hsl.r = mix(120, 60, (value - midpoint2) / (thres2 - midpoint2));
	}
	else
	{
		heatmap_hsl.r = 0.0;
	}

	return hsv2rgb(heatmap_hsl);
}
