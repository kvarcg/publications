//----------------------------------------------------//
//                                                    //
// This is a free rendering engine. The library and   //
// the source code are free. If you use this code as  //
// is or any part of it in any kind of project or     //
// product, please acknowledge the source and its	  //
// author.											  //
//                                                    //
// For manuals, help and instructions, please visit:  //
// http://graphics.cs.aueb.gr/graphics/               //
//                                                    //
//----------------------------------------------------//
#version 330 core

layout(location = 0) out uvec2 out_itemID;

uniform uint uniform_itemID;

void main(void)
{
	// item buffer
	out_itemID.x = uniform_itemID;
	// TODO: this is test value
	out_itemID.y = 11u;
}
