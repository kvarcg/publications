//----------------------------------------------------//
//													  // 
// Copyright: Athens University of Economics and	  //
// Business											  //
// Authors: Kostas Vardis, Georgios Papaioannou   	  //
// 													  //
// If you use this code as is or any part of it in    //
// any kind of project or product, please acknowledge // 
// the source and its authors.						  //
//                                                    //
//----------------------------------------------------//
#version 330 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform sampler2D sampler_buffer;
uniform float uniform_key;
uniform float uniform_L_white;
uniform float uniform_L_world;


// RGB-to-HSV-to-RGB convertions adapted from:
// http://chilliant.blogspot.gr/2010/11/rgbhsv-in-hlsl.html

vec3 RGBtoHSV(in vec3 RGB)
{
    vec3 HSV = vec3(0.0,0.0,0.0);
    HSV.z = max(RGB.r, max(RGB.g, RGB.b));
    float M = min(RGB.r, min(RGB.g, RGB.b));
    float C = HSV.z - M;

    if (C != 0.0)
    {
        HSV.y = C / HSV.z;
        vec3 Delta = (HSV.z - RGB) / C;
        Delta.rgb -= Delta.brg;
        Delta.rg += vec2(2.0,4.0);
        if (RGB.r >= HSV.z)
            HSV.x = Delta.b;
        else if (RGB.g >= HSV.z)
            HSV.x = Delta.r;
        else
            HSV.x = Delta.g;
        HSV.x = fract(HSV.x / 6.0);
    }
    return HSV;
}

vec3 Hue(float H)
{
    float R = abs(H * 6.0 - 3.0) - 1.0;
    float G = 2 - abs(H * 6.0 - 2.0);
    float B = 2 - abs(H * 6.0 - 4.0);
    return clamp(vec3(R,G,B),vec3(0.0,0.0,0.0),vec3(1.0,1.0,1.0));
}

vec3 HSVtoRGB(in vec3 HSV)
{
    return ((Hue(HSV.x) - 1) * HSV.y + 1) * HSV.z;
}

void main(void)
{
	vec4 tex_color = texture2D(sampler_buffer, TexCoord.xy);
	
	vec3 hsv = RGBtoHSV(tex_color.rgb);
	float L = hsv.z * uniform_key / (uniform_L_world+0.01);
	float L_d = L * (1.0 + L/(uniform_L_white*uniform_L_white)) / (1.0 + L);
	hsv.z = L_d;

	//hsv.y = hsv.y * clamp(uniform_L_world/uniform_key,0.6,1);
	
	out_color = vec4(HSVtoRGB(hsv),1.0);

	out_color.rgb = clamp(out_color.rgb, vec3(0), vec3(1));
	out_color.a = 1.0;

	//out_color = tex_color;
}
