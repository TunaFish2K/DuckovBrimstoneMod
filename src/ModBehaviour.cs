using System.Runtime.CompilerServices;

namespace DuckovBrimstoneMod
{
    public class ModBehaviour : Duckov.Modding.ModBehaviour
    {
        public static ModBehaviour Instance { get; private set; }
        private void Awake()
        {
            Instance = this;
        }
    }
}
