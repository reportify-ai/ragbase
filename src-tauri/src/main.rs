// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod process;

use commands::*;
use process::ProcessManager;
use std::sync::Arc;
use std::time::Duration;
use std::thread;
use tauri::Manager;
use tauri::menu::{Menu, Submenu, MenuItemBuilder};

fn main() {
    let process_manager = Arc::new(ProcessManager::new());
    
    // Clone for the health check thread
    let health_check_manager = Arc::clone(&process_manager);
    
    // Clone for cleanup on exit
    let cleanup_manager = Arc::clone(&process_manager);
    
    println!("[tauri/main] Setting up signal handlers...");
    
    // Register cleanup on process exit for Ctrl+C
    ctrlc::set_handler(move || {
        println!("[tauri/main] Received interrupt signal (Ctrl+C), cleaning up...");
        cleanup_manager.stop_all_processes();
        std::process::exit(0);
    }).expect("Error setting Ctrl-C handler");
    
    println!("[tauri/main] Signal handlers setup completed");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(process_manager.clone())
        .invoke_handler(tauri::generate_handler![
            select_directories,
            open_file,
            get_app_data_dir,
            get_app_info,
            check_process_status,
            restart_next_server,
            restart_background_tasks,
            start_next_server,
            start_background_tasks
        ])
        .menu(|app| {
            // Menu Item: id = "custom-quit", Text = "Quit RAGBASE", Accelerator = Cmd/Ctrl + Q
            let quit = MenuItemBuilder::new("Quit RAGBASE")
                .id("custom-quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;       // Note: v2's builder needs to pass the app handle to build

            // Submenu "RAGBASE"
            let app_menu = Submenu::with_items(app, "RAGBASE", true, &[&quit])?;

            // Root menu
            Menu::with_items(app, &[&app_menu])
        })
        .setup(move |app| {
            println!("[tauri/main] Starting RAGBASE application...");
            
            // Run database migration first
            println!("[tauri/main] Running database migration...");
            if let Err(e) = process_manager.run_database_migration() {
                eprintln!("[tauri/main] Database migration failed: {}", e);
                // Continue with startup even if migration fails
            } else {
                println!("[tauri/main] Database migration completed successfully");
            }
            
            // Start Next.js server
            if let Err(e) = process_manager.start_next_server() {
                eprintln!("[tauri/main] Failed to start Next.js server: {}", e);
            } else {
                println!("[tauri/main] Next.js server startup initiated");
            }
            
            // Start background tasks immediately
            if let Err(e) = process_manager.start_background_tasks() {
                eprintln!("[tauri/main] Failed to start background tasks: {}", e);
            } else {
                println!("[tauri/main] Background tasks startup initiated");
            }

            // Wait for Next.js server to start on port 3000
            println!("[tauri/main] Waiting for Next.js server to start on port 3000...");
            if process::ProcessManager::wait_for_port(3000, 30) {
                println!("[tauri/main] Next.js server is ready on port 3000");
                
                // Set the window URL after server is ready
                let dev_url = "http://localhost:3000";
                println!("[tauri/main] Setting window URL to: {}", dev_url);
                
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.eval(&format!("window.location.href = '{}';", dev_url)) {
                        eprintln!("[tauri/main] Failed to set window URL: {}", e);
                    } else {
                        println!("[tauri/main] Successfully set window URL to: {}", dev_url);
                    }
                }
            } else {
                eprintln!("[tauri/main] Failed to wait for Next.js server, window URL not set");
            }
                        
            // Start health check thread
            thread::spawn(move || {
                loop {
                    thread::sleep(Duration::from_secs(30)); // Check every 30 seconds
                    
                    let (next_running, tasks_running) = health_check_manager.check_processes_health();
                    
                    if !next_running {
                        println!("[tauri/main] Next.js process is not running, attempting restart...");
                        if let Err(e) = health_check_manager.start_next_server() {
                            eprintln!("[tauri/main] Failed to restart Next.js server: {}", e);
                        }
                    }
                    
                    if !tasks_running {
                        println!("[tauri/main] Background tasks process is not running, attempting restart...");
                        if let Err(e) = health_check_manager.start_background_tasks() {
                            eprintln!("[tauri/main] Failed to restart background tasks: {}", e);
                        }
                    }
                }
            });
            
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == "custom-quit" {
                println!("[tauri/main] ===== CUSTOM QUIT TRIGGERED =====");
                println!("[tauri/main] User pressed Cmd+Q or clicked Quit menu");
                
                // Get the process manager and clean up
                let process_manager = app.state::<Arc<ProcessManager>>();
                process_manager.stop_all_processes();
                
                println!("[tauri/main] Custom quit cleanup completed");
                
                app.cleanup_before_exit();
                app.exit(0);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { code, .. } => {
                    println!("[tauri/main] ===== EXIT REQUESTED EVENT TRIGGERED =====");
                    println!("[tauri/main] Exit code: {:?}", code);
                    
                    // Get the process manager and clean up
                    let process_manager = app_handle.state::<Arc<ProcessManager>>();
                    process_manager.stop_all_processes();
                    
                    println!("[tauri/main] Exit cleanup completed");
                    
                    // Allow the exit to proceed
                    // api.prevent_exit(); // Uncomment this if you want to prevent exit
                }
                tauri::RunEvent::WindowEvent { event, .. } => {
                    match event {
                        tauri::WindowEvent::CloseRequested { .. } => {
                            println!("[tauri/main] Window close requested, cleaning up...");
                            let process_manager = app_handle.state::<Arc<ProcessManager>>();
                            process_manager.stop_all_processes();
                            
                            // Allow the window to close
                            // api.prevent_close(); // Uncomment this if you want to prevent close
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        });
}
