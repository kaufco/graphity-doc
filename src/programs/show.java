void show(List<Note> notes) {
  out.println(notes.size() + " notes");                  // entry
  for (Note note : notes) {                              // nextNote: another note?
    List<String> lines = format(note).lines().toList();  // format
    for (String line : lines) {                          // nextLine: another line?
      out.println("  " + line);                          // print
    }
  }
  out.flush();                                           // exit
}
