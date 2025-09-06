import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllSystemSettings, 
  getSystemSetting, 
  updateSystemSetting, 
  upsertSystemSetting,
  deleteSystemSetting 
} from '@/db/system-settings';

// Get all system settings or specific setting by key
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (key) {
      // Get specific setting by key
      const setting = await getSystemSetting(key);
      if (!setting) {
        return NextResponse.json(
          { error: `Setting with key '${key}' not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(setting);
    } else {
      // Get all settings
      const settings = await getAllSystemSettings();
      return NextResponse.json(settings);
    }
  } catch (error) {
    console.error('Failed to get system settings:', error);
    return NextResponse.json(
      { error: 'Failed to get system settings' },
      { status: 500 }
    );
  }
}

// Update or create system setting
export async function PUT(req: NextRequest) {
  try {
    const { key, value, description } = await req.json();

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Setting key is required and must be a string' },
        { status: 400 }
      );
    }

    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Setting value is required' },
        { status: 400 }
      );
    }

    const setting = await upsertSystemSetting(key, String(value), description);
    return NextResponse.json(setting);
  } catch (error) {
    console.error('Failed to update system setting:', error);
    return NextResponse.json(
      { error: 'Failed to update system setting' },
      { status: 500 }
    );
  }
}

// Delete system setting
export async function DELETE(req: NextRequest) {
  try {
    const { key } = await req.json();

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Setting key is required and must be a string' },
        { status: 400 }
      );
    }

    // Check if setting exists
    const existing = await getSystemSetting(key);
    if (!existing) {
      return NextResponse.json(
        { error: `Setting with key '${key}' not found` },
        { status: 404 }
      );
    }

    await deleteSystemSetting(key);
    return NextResponse.json({ success: true, message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Failed to delete system setting:', error);
    return NextResponse.json(
      { error: 'Failed to delete system setting' },
      { status: 500 }
    );
  }
}
