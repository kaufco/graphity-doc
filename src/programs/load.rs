fn load(file: &Path) -> Vec<Note> {
    let lines = read(file);                    // entry
    let mut notes = Vec::new();
    let mut i = 0;
    while i < lines.len() {                    // header: i < lines.len()
        let line = &lines[i];                  // body
        if !line.trim().is_empty() {
            notes.push(parse(line));           // then
        }
        i += 1;                                // next
    }
    notes                                      // exit
}
