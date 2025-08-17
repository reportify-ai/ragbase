use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::process::ProcessManager;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenFileResult {
    success: bool,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessStatus {
    next_running: bool,
    tasks_running: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    data_dir: String,
    is_dev: bool,
    project_root: String,
}

/// Select directories command
#[tauri::command]
pub async fn select_directories(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    println!("[tauri/commands] select_directories called");
    
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    let tx = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
    
    println!("[tauri/commands] Creating dialog...");
    let dialog = app.dialog().file();
    
    println!("[tauri/commands] Opening folder picker...");
    dialog
        .set_title("Select directories to sync")
        .pick_folders(move |folder_paths| {
            println!("[tauri/commands] Folder picker callback triggered with result: {:?}", folder_paths.is_some());
            if let Ok(mut sender_guard) = tx.lock() {
                if let Some(sender) = sender_guard.take() {
                    let _ = sender.send(folder_paths);
                    println!("[tauri/commands] Sent result to channel");
                } else {
                    println!("[tauri/commands] Sender already taken");
                }
            } else {
                println!("[tauri/commands] Failed to lock sender");
            }
        });
    
    println!("[tauri/commands] Waiting for folder selection result...");
    let folder_paths = rx.await.map_err(|e| {
        let error_msg = format!("Failed to receive directory selection result: {}", e);
        println!("[tauri/commands] Error: {}", error_msg);
        error_msg
    })?;
    
    match folder_paths {
        Some(paths) => {
            println!("[tauri/commands] Selected {} folders", paths.len());
            let path_strings: Vec<String> = paths
                .into_iter()
                .map(|path| {
                    let path_str = path.to_string();
                    println!("[tauri/commands] Selected folder: {}", path_str);
                    path_str
                })
                .collect();
            Ok(path_strings)
        },
        None => {
            println!("[tauri/commands] User cancelled folder selection");
            Ok(vec![]) // User cancelled selection
        },
    }
}

/// Open file command
#[tauri::command]
pub async fn open_file(file_path: String, app: tauri::AppHandle) -> Result<OpenFileResult, String> {
    let path = PathBuf::from(&file_path);
    
    if !path.exists() {
        return Ok(OpenFileResult {
            success: false,
            error: Some("File does not exist".to_string()),
        });
    }

    // Use Tauri opener plugin to open file
    match app.opener().open_url(&file_path, None::<String>) {
        Ok(_) => Ok(OpenFileResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(OpenFileResult {
            success: false,
            error: Some(format!("Failed to open file: {}", e)),
        }),
    }
}

/// Get application data directory
#[tauri::command]
pub async fn get_app_data_dir() -> Result<String, String> {
    let app_data_dir = crate::process::ProcessManager::get_data_dir();
    
    // Ensure directory exists
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    
    Ok(app_data_dir)
}

/// Get application information
#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    let is_dev = std::env::var("RUST_ENV").unwrap_or_default() == "development" 
        || cfg!(debug_assertions);
    
    let data_dir = crate::process::ProcessManager::get_data_dir();
    
    let project_root = std::env::current_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .to_string_lossy()
        .to_string();
    
    Ok(AppInfo {
        data_dir,
        is_dev,
        project_root,
    })
}

/// Check process status
#[tauri::command]
pub async fn check_process_status(
    process_manager: State<'_, std::sync::Arc<ProcessManager>>
) -> Result<ProcessStatus, String> {
    let (next_running, tasks_running) = process_manager.check_processes_health();
    
    Ok(ProcessStatus {
        next_running,
        tasks_running,
    })
}

/// Restart Next.js server
#[tauri::command]
pub async fn restart_next_server(
    process_manager: State<'_, std::sync::Arc<ProcessManager>>
) -> Result<(), String> {
    println!("[tauri/commands] Restarting Next.js server...");
    
    // Stop existing process
    if let Ok(mut guard) = process_manager.next_process.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
    
    // Start new process
    process_manager.start_next_server()
        .map_err(|e| format!("Failed to restart Next.js server: {}", e))?;
    
    Ok(())
}

/// Restart background tasks
#[tauri::command]
pub async fn restart_background_tasks(
    process_manager: State<'_, std::sync::Arc<ProcessManager>>
) -> Result<(), String> {
    println!("[tauri/commands] Restarting background tasks...");
    
    // Stop existing process
    if let Ok(mut guard) = process_manager.tasks_process.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
    
    // Start new process
    process_manager.start_background_tasks()
        .map_err(|e| format!("Failed to restart background tasks: {}", e))?;
    
    Ok(())
}

/// Start Next.js server
#[tauri::command]
pub async fn start_next_server(
    process_manager: State<'_, std::sync::Arc<ProcessManager>>
) -> Result<(), String> {
    println!("[tauri/commands] Starting Next.js server...");
    
    process_manager.start_next_server()
        .map_err(|e| format!("Failed to start Next.js server: {}", e))?;
    
    Ok(())
}

/// Start background tasks
#[tauri::command]
pub async fn start_background_tasks(
    process_manager: State<'_, std::sync::Arc<ProcessManager>>
) -> Result<(), String> {
    println!("[tauri/commands] Starting background tasks...");
    
    process_manager.start_background_tasks()
        .map_err(|e| format!("Failed to start background tasks: {}", e))?;
    
    Ok(())
}
