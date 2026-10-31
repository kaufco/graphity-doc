List<Note> Load(string file)
{
    string[] lines = Read(file);                // entry
    var notes = new List<Note>();
    for (int i = 0; i < lines.Length; i++)      // header: i < lines.Length
    {
        string line = lines[i];                 // body
        if (!string.IsNullOrWhiteSpace(line))
        {
            notes.Add(Parse(line));             // then
        }
    }                                           // next: i++
    return notes;                               // exit
}
